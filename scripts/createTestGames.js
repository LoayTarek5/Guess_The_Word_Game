// seedGamesFull.js
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Game from "../models/Games.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/guess_the_word_game";

/* CONFIG */
const BASE_USERNAME = "Bob";
const NUM_GAMES = 80;     // total games to insert
const CLEAN_GAMES = true; // if true, delete existing games involving base user before inserting
/* END CONFIG */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max, decimals = 2) {
  const p = Math.pow(10, decimals);
  return Math.round((Math.random() * (max - min) + min) * p) / p;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function makeGameId(i = 0) {
  return `seed-game-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`;
}

async function recomputeStatsFromGames() {
  // aggregate only completed games
  const agg = await Game.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$players" },
    {
      $group: {
        _id: "$players.user",
        totalGames: { $sum: 1 },
        totalWordsGuessed: { $sum: { $ifNull: ["$players.wordsGuessed", 0] } },
        wins: { $sum: { $cond: [{ $eq: ["$winner", "$players.user"] }, 1, 0] } },
        draws: { $sum: { $cond: [{ $eq: ["$winner", null] }, 1, 0] } },
        losses: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$winner", null] }, { $ne: ["$winner", "$players.user"] }] },
              1,
              0
            ]
          }
        },
        avgGuessTime: { $avg: { $ifNull: ["$players.averageGuessTime", 0] } }
      }
    }
  ]);

  const bulkOps = agg.map(r => {
    let targetId = r._id;
    if (typeof r._id === "string") targetId = new mongoose.Types.ObjectId(r._id);

    const totalGames = r.totalGames || 0;
    const wins = r.wins || 0;
    const losses = r.losses || 0;
    const draws = r.draws || 0;
    const totalWordsGuessed = r.totalWordsGuessed || 0;
    const level = Math.floor(totalGames / 5) + 1;
    const experience = (wins * 100) + (draws * 50) + (losses * 20);
    const avgGuessTime = r.avgGuessTime ? Math.round(r.avgGuessTime * 100) / 100 : null;

    return {
      updateOne: {
        filter: { _id: targetId },
        update: {
          $set: {
            "stats.totalGames": totalGames,
            "stats.gamesWon": wins,
            "stats.gamesLost": losses,
            "stats.gamesDraw": draws,
            "stats.totalWordsGuessed": totalWordsGuessed,
            "stats.level": level,
            "stats.experience": experience,
            "stats.averageGuessTime": avgGuessTime
          }
        }
      }
    };
  });

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
    console.log(`Recomputed stats for ${bulkOps.length} users.`);
  } else {
    console.log("No completed games found to recompute stats.");
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB.");

  try {
    const baseUser = await User.findOne({ username: BASE_USERNAME });
    if (!baseUser) throw new Error(`Base user ${BASE_USERNAME} not found.`);

    // find other users to act as opponents (exclude base)
    const opponents = await User.find({ _id: { $ne: baseUser._id } }).lean();
    if (!opponents || opponents.length === 0) {
      throw new Error("No opponents found — create other users first or run a user-seed script.");
    }

    if (CLEAN_GAMES) {
      console.log("Deleting existing games that involve base user...");
      await Game.deleteMany({
        "players.user": baseUser._id
      });
    }

    const wordPool = [
      { w: "apple", hint: "A fruit", category: "food", difficulty: "easy" },
      { w: "ocean", hint: "Large body of water", category: "nature", difficulty: "easy" },
      { w: "javascript", hint: "Programming language", category: "tech", difficulty: "medium" },
      { w: "pyramid", hint: "Ancient structure", category: "history", difficulty: "medium" },
      { w: "metamorphosis", hint: "A transformation", category: "science", difficulty: "hard" }
    ];
    const categories = ["general", "food", "nature", "tech", "history", "sports"];
    const difficulties = ["easy", "medium", "hard"];

    const games = [];

    for (let i = 0; i < NUM_GAMES; i++) {
      const opp = opponents[i % opponents.length];
      // game settings
      const maxPlayers = pick([2, 2, 2, 3]); // mostly 2, sometimes 3
      const roundsToWin = randomInt(1, 4);
      const timePerRound = pick([30, 45, 60, 90, 120]);
      const difficulty = pick(difficulties);
      const category = pick(categories);

      const gameSettings = {
        maxPlayers,
        roundsToWin,
        timePerRound,
        difficulty,
        category
      };

      const createdAt = new Date(Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000);
      const startedAt = new Date(createdAt.getTime() + randomInt(0, 60) * 1000); // within a minute
      // build players array (base + opponent, support for 2 players)
      const p1Score = randomInt(0, 10);
      const p2Score = randomInt(0, 10);
      const p1Words = randomInt(0, Math.max(1, p1Score));
      const p2Words = randomInt(0, Math.max(1, p2Score));

      const players = [
        {
          user: baseUser._id,
          score: p1Score,
          wordsGuessed: p1Words,
          averageGuessTime: randomFloat(1.0, 8.0, 2), // seconds
          isReady: true,
          joinedAt: new Date(createdAt.getTime() + randomInt(0, 5) * 1000)
        },
        {
          user: opp._id,
          score: p2Score,
          wordsGuessed: p2Words,
          averageGuessTime: randomFloat(1.0, 9.0, 2),
          isReady: true,
          joinedAt: new Date(createdAt.getTime() + randomInt(3, 10) * 1000)
        }
      ];

      // rounds: between 1 and roundsToWin*2 (+ some randomness)
      const numRounds = randomInt(1, Math.max(1, roundsToWin * 2 + 1));
      const rounds = [];
      let lastRoundTime = startedAt.getTime();
      for (let r = 1; r <= numRounds; r++) {
        const roundWord = pick(wordPool);
        const roundWinnerPick = randomInt(0, 2); // 0 = base, 1 = opp, 2 = draw
        const winner = roundWinnerPick === 0 ? baseUser._id : roundWinnerPick === 1 ? opp._id : null;
        const guessTime = randomFloat(1.0, timePerRound - 1, 2); // seconds
        const attempts = randomInt(1, 6);
        lastRoundTime += (timePerRound * 1000) + randomInt(0, 60) * 1000;
        rounds.push({
          roundNumber: r,
          word: roundWord.w,
          hint: roundWord.hint,
          winner,
          guessTime,
          attempts,
          completedAt: new Date(lastRoundTime)
        });
      }

      // currentWord: if game completed, put last round's info; otherwise random
      const gameStatus = "completed";
      const lastRound = rounds[rounds.length - 1] || null;
      const currentWord = lastRound
        ? {
            word: lastRound.word,
            hint: lastRound.hint,
            category: category,
            difficulty: difficulty,
            guessedBy: lastRound.winner,
            guessTime: lastRound.guessTime,
            attempts: lastRound.attempts
          }
        : {
            word: pick(wordPool).w,
            hint: pick(wordPool).hint,
            category,
            difficulty,
            guessedBy: null,
            guessTime: null,
            attempts: 0
          };

      // finalScores: compute from players array (copying score/words/average)
      const finalScores = players.map(p => ({
        user: p.user,
        score: p.score,
        wordsGuessed: p.wordsGuessed,
        averageTime: p.averageGuessTime
      }));

      // winner: decide by comparing scores, null on draw
      const winner =
        p1Score === p2Score ? null : (p1Score > p2Score ? baseUser._id : opp._id);

      const completedAt = new Date(startedAt.getTime() + randomInt(2, 60) * 60 * 1000);

      games.push({
        gameId: makeGameId(i),
        players,
        gameSettings,
        status: gameStatus,
        currentRound: rounds.length,
        currentTurn: pick(players).user,
        currentWord,
        rounds,
        winner,
        finalScores,
        createdAt,
        startedAt,
        completedAt,
        updatedAt: new Date(),
        meta: { seeded: true }
      });
    }

    const inserted = await Game.insertMany(games, { ordered: false });
    console.log(`Inserted ${inserted.length} games.`);

    // recompute stats for all users
    console.log("Recomputing stats from Games (Approach B)...");
    await recomputeStatsFromGames();

    // summary: games involving base user
    const totalGamesForBase = await Game.countDocuments({
      "players.user": baseUser._id
    });
    console.log(`Games involving ${BASE_USERNAME}: ${totalGamesForBase}`);
  } catch (err) {
    console.error("Script error:", err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

main();

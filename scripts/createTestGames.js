import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Game from "../models/Games.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/guess_the_word_game";

/* CONFIG */
const BASE_USERNAME = "Bob";
const NUM_GAMES = 30;     // total games to insert
const CLEAN_GAMES = true; // if true, delete existing games involving base user before inserting
/* END CONFIG */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeGameId(i = 0) {
  return `seed-game-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`;
}

async function recomputeStatsFromGames() {
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
        }
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
            "stats.experience": experience
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
        $or: [
          { player1: baseUser._id },
          { player2: baseUser._id },
          { "players.user": baseUser._id }
        ]
      });
    }

    // Build games distributed across opponents (round-robin)
    const games = [];
    for (let i = 0; i < NUM_GAMES; i++) {
      const opp = opponents[i % opponents.length];
      const p1Score = randomInt(0, 5);
      const p2Score = randomInt(0, 5);
      const createdAt = new Date(Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000);

      games.push({
        gameId: makeGameId(i),
        player1: baseUser._id,
        player2: opp._id,
        player1Score: p1Score,
        player2Score: p2Score,
        players: [
          { user: baseUser._id, score: p1Score, wordsGuessed: p1Score },
          { user: opp._id, score: p2Score, wordsGuessed: p2Score }
        ],
        winner: p1Score === p2Score ? null : (p1Score > p2Score ? baseUser._id : opp._id),
        status: "completed",
        createdAt,
        startedAt: createdAt,
        completedAt: new Date(createdAt.getTime() + randomInt(2, 10) * 60 * 1000),
        meta: { seeded: true }
      });
    }

    const inserted = await Game.insertMany(games, { ordered: false });
    console.log(`Inserted ${inserted.length} games.`);

    // recompute stats for all users
    console.log("Recomputing stats from Games (Approach B)...");
    await recomputeStatsFromGames();

    // summary
    const totalGamesForBase = await Game.countDocuments({
      $or: [{ player1: baseUser._id }, { player2: baseUser._id }, { "players.user": baseUser._id }]
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

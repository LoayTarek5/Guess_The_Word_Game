import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Game from "../models/Games.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/guess_the_word_game";
const MOCK_OPPONTS = [
  { username: "Alex_Player", email: "alex@test.com", password: "test123" },
  { username: "Sarah_Gamer", email: "sarah@test.com", password: "test123" },
  { username: "Mike_Pro", email: "mike@test.com", password: "test123" },
  { username: "Emma_Word", email: "emma@test.com", password: "test123" }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeGameId(i = 0) {
  return `test-game-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`;
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  try {
    const user = await User.findOne({ username: "Bob" });
    if (!user) {
      console.error("❌ No base user found: Bob");
      return;
    }
    console.log("Found user:", user.username);

    // find opponents (exclude current user)
    let opponents = await User.find({ _id: { $ne: user._id } });

    // create mock opponents if none
    if (!Array.isArray(opponents) || opponents.length === 0) {
      console.log("No other users found, creating mock opponents...");
      for (const m of MOCK_OPPONTS) {
        if (!m?.username || !m?.email) {
          console.warn("Skipping invalid mock opponent:", m);
          continue;
        }
        const exists = await User.findOne({ $or: [{ username: m.username }, { email: m.email }] });
        if (exists) opponents.push(exists);
        else {
          const created = new User(m);
          await created.save();
          opponents.push(created);
        }
      }
    }

    console.log(`Total opponents available: ${opponents.length}`);

    // Build games array (one or more games per opponent)
    const gamesToCreate = [];
    let i = 0;
    for (const opp of opponents) {
      // create a few games per opponent (random 1..3)
      const count = randomInt(1, 3);
      for (let j = 0; j < count; j++, i++) {
        const p1Score = randomInt(0, 5);
        const p2Score = randomInt(0, 5);

        const createdAt = new Date(Date.now() - randomInt(0, 180) * 24 * 60 * 60 * 1000); // up to ~180 days ago

        const gameDoc = {
          gameId: makeGameId(i),
          player1: user._id,
          player2: opp._id,
          player1Score: p1Score,
          player2Score: p2Score,
          players: [
            { user: user._id, score: p1Score },
            { user: opp._id, score: p2Score }
          ],
          winner: p1Score === p2Score ? null : (p1Score > p2Score ? user._id : opp._id),
          status: "completed",
          createdAt,
          startedAt: createdAt,
          completedAt: new Date(createdAt.getTime() + randomInt(2, 10) * 60 * 1000),
          meta: { seeded: true }
        };

        gamesToCreate.push(gameDoc);
      }
    }

    if (gamesToCreate.length === 0) {
      console.warn("No games were built. Aborting.");
      return;
    }

    // Insert games (ordered:false so duplicates won't abort all)
    const inserted = await Game.insertMany(gamesToCreate, { ordered: false });
    console.log(`✅ Created ${inserted.length} test games`);

    // Approach B: recompute stats for all users from the Games collection
    console.log("Recomputing stats from Games collection (Approach B)...");
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

    // --- FIX: construct ObjectId with `new` only when needed ---
    const bulkOps = agg.map(r => {
      // r._id may already be an ObjectId or a string — normalize safely
      let targetId = r._id;
      if (typeof r._id === "string") {
        // create a new ObjectId instance from string id
        targetId = new mongoose.Types.ObjectId(r._id);
      } else {
        // leave as-is (it's probably already an ObjectId)
        targetId = r._id;
      }

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
      const res = await User.bulkWrite(bulkOps);
      console.log(`✅ Recomputed & updated stats for ${bulkOps.length} users`);
    } else {
      console.log("No completed games found — no stats updated.");
    }
  } catch (err) {
    console.error("❌ Error creating test games:", err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

main();

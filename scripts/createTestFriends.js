import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Friendship from "../models/Friendship.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/guess_the_word_game";

/* CONFIG */
const BASE_USERNAME = "Bob";
const TARGET_ACCEPTED = 12;
const TARGET_PENDING_RECEIVED = 5;
const TARGET_PENDING_SENT = 4;
const CLEAN_FRIENDSHIPS = true; // if true, delete existing friendships involving Bob first
/* END CONFIG */

function mkCandidate(idx) {
  return {
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@test.test`,
    password: "test123"
  };
}

async function ensureUsers(requiredCount, baseUserId) {
  const others = await User.find({ _id: { $ne: baseUserId } }).lean();
  const missing = requiredCount - others.length;
  if (missing <= 0) return others;

  console.log(`Need ${missing} more users; creating mock users...`);
  const created = [];
  let idx = 1;
  while (created.length < missing) {
    const candidate = mkCandidate(idx++);
    const exists = await User.findOne({ $or: [{ username: candidate.username }, { email: candidate.email }] });
    if (exists) continue;
    const u = await User.create(candidate);
    created.push(u.toObject ? u.toObject() : u);
  }
  return others.concat(created);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.");

  try {
    const baseUser = await User.findOne({ username: BASE_USERNAME });
    if (!baseUser) throw new Error(`Base user ${BASE_USERNAME} not found.`);

    const totalNeeded = TARGET_ACCEPTED + TARGET_PENDING_RECEIVED + TARGET_PENDING_SENT;
    const others = await ensureUsers(totalNeeded, baseUser._id);

    const acceptedUsers = others.slice(0, TARGET_ACCEPTED);
    const pendingReceived = others.slice(TARGET_ACCEPTED, TARGET_ACCEPTED + TARGET_PENDING_RECEIVED);
    const pendingSent = others.slice(TARGET_ACCEPTED + TARGET_PENDING_RECEIVED, TARGET_ACCEPTED + TARGET_PENDING_RECEIVED + TARGET_PENDING_SENT);

    if (CLEAN_FRIENDSHIPS) {
      console.log("Deleting existing friendships involving base user...");
      await Friendship.deleteMany({ $or: [{ requester: baseUser._id }, { recipient: baseUser._id }] });
    }

    // create accepted
    console.log(`Creating ${acceptedUsers.length} accepted friendships...`);
    for (const u of acceptedUsers) {
      const exists = await Friendship.findOne({
        $or: [
          { requester: baseUser._id, recipient: u._id },
          { requester: u._id, recipient: baseUser._id }
        ]
      });
      if (exists) {
        exists.status = "accepted";
        await exists.save();
      } else {
        await Friendship.create({
          requester: baseUser._id,
          recipient: u._id,
          status: "accepted",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // pending received (others -> Bob)
    console.log(`Creating ${pendingReceived.length} pending received requests...`);
    for (const u of pendingReceived) {
      const exists = await Friendship.findOne({
        $or: [
          { requester: u._id, recipient: baseUser._id },
          { requester: baseUser._id, recipient: u._id }
        ]
      });
      if (exists) {
        exists.status = "pending";
        exists.requester = u._id;
        exists.recipient = baseUser._id;
        exists.updatedAt = new Date();
        await exists.save();
      } else {
        await Friendship.create({
          requester: u._id,
          recipient: baseUser._id,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // pending sent (Bob -> others)
    console.log(`Creating ${pendingSent.length} pending sent requests...`);
    for (const u of pendingSent) {
      const exists = await Friendship.findOne({
        $or: [
          { requester: baseUser._id, recipient: u._id },
          { requester: u._id, recipient: baseUser._id }
        ]
      });
      if (exists) {
        exists.status = "pending";
        exists.requester = baseUser._id;
        exists.recipient = u._id;
        exists.updatedAt = new Date();
        await exists.save();
      } else {
        await Friendship.create({
          requester: baseUser._id,
          recipient: u._id,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Final counts
    const friendsCount = await Friendship.countDocuments({
      $or: [{ requester: baseUser._id, status: "accepted" }, { recipient: baseUser._id, status: "accepted" }]
    });
    const pendingReceivedCount = await Friendship.countDocuments({ recipient: baseUser._id, status: "pending" });
    const pendingSentCount = await Friendship.countDocuments({ requester: baseUser._id, status: "pending" });

    console.log("\n--- Final counts for Bob ---");
    console.log(`Friends count: ${friendsCount}`);
    console.log(`Pending received count: ${pendingReceivedCount}`);
    console.log(`Pending sent count: ${pendingSentCount}`);

  } catch (err) {
    console.error("ERROR:", err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

main();

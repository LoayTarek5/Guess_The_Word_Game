// createTestNotifications.js
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/guess_the_word_game";

/* CONFIG */
const BASE_USERNAME = "Bob";
const NUM_NOTIFICATIONS = 80;     // total notifications to insert
const CLEAN_NOTIFICATIONS = true; // if true, delete existing notifications for base user before inserting
/* END CONFIG */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeNotificationId() {
  return `seed-notif-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function generateRandomGameId() {
  return `game-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to DB.");

  try {
    const baseUser = await User.findOne({ username: BASE_USERNAME });
    if (!baseUser) throw new Error(`Base user ${BASE_USERNAME} not found.`);

    // find other users to act as senders (exclude base)
    const otherUsers = await User.find({ _id: { $ne: baseUser._id } }).lean();
    if (!otherUsers || otherUsers.length === 0) {
      throw new Error("No other users found – create other users first or run a user-seed script.");
    }

    if (CLEAN_NOTIFICATIONS) {
      console.log("Deleting existing notifications for base user...");
      await Notification.deleteMany({
        recipient: baseUser._id
      });
    }

    const notificationTypes = [
      "friend_request",
      "friend_accepted", 
      "friend_rejected",
      "game_invitation",
      "game_started",
      "your_turn",
      "turn_reminder",
      "game_completed",
      "match_result",
      "achievement",
      "leaderboard_update",
      "system",
      "chat_message",
      "game_abandoned",
    ];

    const achievements = [
      "First Win",
      "Speed Demon", 
      "Word Master",
      "Streak Champion",
      "Perfect Round",
      "Lightning Fast",
      "Vocabulary Expert",
      "Social Player",
      "Comeback King",
      "Consistent Player"
    ];

    const gameWords = [
      "apple", "ocean", "javascript", "pyramid", "metamorphosis",
      "guitar", "elephant", "rainbow", "mountain", "telescope",
      "butterfly", "computer", "adventure", "mystery", "celebration"
    ];

    const notifications = [];

    for (let i = 0; i < NUM_NOTIFICATIONS; i++) {
      const sender = pick(otherUsers);
      const notifType = pick(notificationTypes);
      const createdAt = new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000); // last 90 days
      const isRead = randomInt(1, 100) <= 70; // 70% chance of being read
      const readAt = isRead ? new Date(createdAt.getTime() + randomInt(1, 60) * 60 * 1000) : null;

      let title, message, data = {};
      let expiresAt = null;

      switch (notifType) {
        case "friend_request":
          title = "New Friend Request";
          message = `${sender.username} sent you a friend request`;
          data.friendRequestId = new mongoose.Types.ObjectId();
          if (!isRead) {
            expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000); // expire in 30 days
          }
          break;

        case "friend_accepted":
          title = "Friend Request Accepted";
          message = `${sender.username} accepted your friend request`;
          data.friendRequestId = new mongoose.Types.ObjectId();
          break;

        case "friend_rejected":
          title = "Friend Request Declined";
          message = `${sender.username} declined your friend request`;
          data.friendRequestId = new mongoose.Types.ObjectId();
          break;

        case "game_invitation":
          title = "Game Invitation";
          message = `${sender.username} invited you to play a game`;
          const gameId = generateRandomGameId();
          data.gameIdString = gameId;
          data.gameSettings = {
            maxPlayers: pick([2, 3, 4]),
            roundsToWin: randomInt(1, 5),
            timePerRound: pick([30, 45, 60, 90, 120]),
            difficulty: pick(["easy", "medium", "hard"]),
            category: pick(["general", "food", "nature", "tech"])
          };
          if (!isRead) {
            expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // expire in 24 hours
          }
          break;

        case "game_started":
          title = "Game Started";
          message = `Your game with ${sender.username} has begun!`;
          data.gameIdString = generateRandomGameId();
          data.gameState = {
            currentRound: 1,
            playersCount: randomInt(2, 4),
            status: "active"
          };
          break;

        case "your_turn":
          title = "Your Turn";
          message = `It's your turn in the game with ${sender.username}`;
          data.gameIdString = generateRandomGameId();
          data.roundInfo = {
            roundNumber: randomInt(1, 5),
            word: pick(gameWords),
            guessTime: randomInt(5, 120),
            attempts: randomInt(1, 6)
          };
          break;

        case "turn_reminder":
          title = "Turn Reminder";
          message = `Don't forget - it's still your turn with ${sender.username}`;
          data.gameIdString = generateRandomGameId();
          break;

        case "game_completed":
          title = "Game Completed";
          const gameResult = pick(["won", "lost", "draw"]);
          message = gameResult === "won" 
            ? `You won against ${sender.username}!`
            : gameResult === "lost"
            ? `${sender.username} won the game`
            : `Your game with ${sender.username} ended in a draw`;
          data.gameIdString = generateRandomGameId();
          data.gameState = {
            status: "completed"
          };
          break;

        case "match_result":
          title = "Match Result";
          const finalScore1 = randomInt(0, 10);
          const finalScore2 = randomInt(0, 10);
          message = `Final score: You ${finalScore1} - ${finalScore2} ${sender.username}`;
          data.gameIdString = generateRandomGameId();
          break;

        case "achievement":
          title = "Achievement Unlocked!";
          const achievement = pick(achievements);
          message = `Congratulations! You unlocked "${achievement}"`;
          data.metadata = {
            achievementName: achievement,
            points: randomInt(50, 500)
          };
          break;

        case "leaderboard_update":
          title = "Leaderboard Update";
          const position = randomInt(1, 100);
          message = `You're now ranked #${position} on the leaderboard!`;
          data.metadata = {
            position,
            category: pick(["weekly", "monthly", "all-time"])
          };
          break;

        case "system":
          title = "System Update";
          const systemMessages = [
            "Welcome to Guess The Word! Check out the tutorial",
            "New features have been added to the game",
            "Scheduled maintenance completed successfully",
            "Your account security settings have been updated",
            "New word categories are now available"
          ];
          message = pick(systemMessages);
          break;

        case "chat_message":
          title = "New Message";
          message = `${sender.username} sent you a message`;
          data.metadata = {
            conversationId: new mongoose.Types.ObjectId(),
            preview: pick([
              "Hey, want to play again?",
              "Good game!",
              "That was a tough word!",
              "Ready for a rematch?",
              "Nice strategy!"
            ])
          };
          break;

        case "game_abandoned":
          title = "Game Abandoned";
          message = `${sender.username} left the game`;
          data.gameIdString = generateRandomGameId();
          data.gameState = {
            status: "abandoned"
          };
          break;

        default:
          title = "Notification";
          message = "You have a new notification";
          break;
      }

      notifications.push({
        recipient: baseUser._id,
        sender: sender._id,
        type: notifType,
        title,
        message,
        data,
        isRead,
        readAt,
        expiresAt,
        createdAt,
        updatedAt: createdAt
      });
    }

    const inserted = await Notification.insertMany(notifications, { ordered: false });
    console.log(`Inserted ${inserted.length} notifications.`);

    // Calculate statistics
    const stats = await calculateNotificationStats(baseUser._id);
    console.log("\nNotification Statistics:");
    console.log(`Total Notifications: ${stats.total}`);
    console.log(`Unread Notifications: ${stats.unread}`);
    console.log(`Friend Requests: ${stats.friendRequests}`);
    console.log(`Game Invites: ${stats.gameInvites}`);
    console.log(`Achievements: ${stats.achievements}`);

    // Show type distribution
    const typeDistribution = await getTypeDistribution(baseUser._id);
    console.log("\nType Distribution:");
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  } catch (err) {
    console.error("Script error:", err && err.stack ? err.stack : err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

async function calculateNotificationStats(userId) {
  const pipeline = [
    { $match: { recipient: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
        friendRequests: {
          $sum: {
            $cond: [{ $in: ["$type", ["friend_request"]] }, 1, 0],
          },
        },
        gameInvites: {
          $sum: {
            $cond: [{ $in: ["$type", ["game_invitation"]] }, 1, 0],
          },
        },
        achievements: {
          $sum: {
            $cond: [{ $in: ["$type", ["achievement"]] }, 1, 0],
          },
        },
      },
    },
  ];

  const [result] = await Notification.aggregate(pipeline);
  return (
    result || {
      total: 0,
      unread: 0,
      friendRequests: 0,
      gameInvites: 0,
      achievements: 0,
    }
  );
}

async function getTypeDistribution(userId) {
  const pipeline = [
    { $match: { recipient: userId } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ];

  const results = await Notification.aggregate(pipeline);
  const distribution = {};
  results.forEach(result => {
    distribution[result._id] = result.count;
  });
  
  return distribution;
}

main();
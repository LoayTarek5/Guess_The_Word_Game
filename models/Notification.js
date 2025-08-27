import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  type: {
    type: String,
    enum: [
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
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  data: {
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game" },
    gameIdString: String,
    gameSettings: {
      maxPlayers: Number,
      roundsToWin: Number,
      timePerRound: Number,
      difficulty: { type: String, enum: ["easy", "medium", "hard"] },
      category: String,
    },
    gameState: {
      currentRound: Number,
      playersCount: Number,
      status: {
        type: String,
        enum: ["waiting", "active", "paused", "completed", "abandoned"],
      },
    },
    roundInfo: {
      roundNumber: Number,
      word: String,
      winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      guessTime: Number,
      attempts: Number,
    },
    friendRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Friendship",
    },
    // Still allow additional flexible data
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  expiresAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for common queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, type: 1, createdAt: -1 });

// Update the updatedAt field before saving
notificationSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Virtual for checking if notification is expired
notificationSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

notificationSchema.virtual("age").get(function () {
  return Date.now() - this.createdAt;
});

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.statics.getGameNotifications = function(userId, gameIdString) {
  return this.find({
    recipient: userId,
    'data.gameIdString': gameIdString
  }).sort({ createdAt: -1 });
};

notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

export default mongoose.model("Notification", notificationSchema);

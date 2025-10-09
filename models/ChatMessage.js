import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema({
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    required: true,
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: false,
  },
  friendship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Friendship",
    required: false,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  chatType: {
    type: String,
    enum: ["room", "game", "direct"],
    required: true,
  },
  type: {
    type: String,
    enum: ["text", "system", "emoji", "hint", "user"],
    default: "text",
  },
  timestamp: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: null,
  },
  isRead: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now },
    },
  ],
});

chatMessageSchema.index({ room: 1, timestamp: -1 });
chatMessageSchema.index({ game: 1, timestamp: -1 });
chatMessageSchema.index({ friendship: 1, timestamp: -1 });
chatMessageSchema.index({ chatType: 1, timestamp: -1 });
chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
chatMessageSchema.index({ sender: 1, timestamp: -1 });

chatMessageSchema.pre("save", function (next) {
  if (this.chatType === "room" && !this.room) {
    return next(new Error("Room reference required for room chat"));
  }
  if (this.chatType === "game" && !this.game) {
    return next(new Error("Game reference required for game chat"));
  }
  if (this.chatType === "direct" && !this.friendship) {
    return next(new Error("Friendship reference required for direct chat"));
  }
  next();
});

chatMessageSchema.statics.getDirectMessages = async function (
  friendshipId,
  limit = 50
) {
  return await this.find({
    friendship: friendshipId,
    chatContext: "direct",
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("sender", "username avatar");
};

chatMessageSchema.statics.getLastMessage = async function (friendshipId) {
  return await this.findOne({
    friendship: friendshipId,
    chatContext: "direct",
  })
    .sort({ timestamp: -1 })
    .populate("sender", "username avatar");
};

export default mongoose.model("ChatMessage", chatMessageSchema);

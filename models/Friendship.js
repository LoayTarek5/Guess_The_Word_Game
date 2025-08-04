import mongoose from "mongoose";

const friendshipSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "blocked"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index to prevent duplicate friendships
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Pre-save middleware
friendshipSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

friendshipSchema.statics.getFriends = async function (userId) {
  return await this.find({
    $or: [
      { requester: userId, status: "accepted" },
      { recipient: userId, status: "accepted" },
    ],
  }).populate("requester recipient", "username avatar status lastSeen stats");
};

friendshipSchema.statics.countFriends = async function (userId) {
  return await this.countDocuments({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  });
};

friendshipSchema.statics.getPendingRequests = async function (userId) {
  return await this.find({ recipient: userId, status: "pending" }).populate(
    "requester",
    "username avatar status lastSeen stats"
  );
};

friendshipSchema.statics.getSentRequests = async function (userId) {
  return await this.find({ requester: userId, status: "pending" }).populate(
    "recipient",
    "username avatar status lastSeen stats"
  );
};

friendshipSchema.statics.isUserOnline = function(lastSeen, status) {
  if (status === "online" || status === "in match") {
    return true;
  }

  /* Consider online if last seen within 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(lastSeen) > fiveMinutesAgo;*/
};

export default mongoose.model("Friendship", friendshipSchema);

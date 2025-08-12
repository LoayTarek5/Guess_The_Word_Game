import mongoose from "mongoose";
import bcrypt, { hash } from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "/images/user-solid.svg" },
    status: {
      type: String,
      enum: ["online", "offline", "in match"],
      default: "offline",
    },
    lastSeen: { type: Date, default: Date.now },
    tokenInvalidatedAt: { type: Date, default: null },
    stats: {
      totalGames: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      gamesLost: { type: Number, default: 0 },
      gamesDraw: { type: Number, default: 0 },
      winStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
      totalWordsGuessed: { type: Number, default: 0 },
      averageGuessTime: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      experience: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();
  if (!this.isModified("password")) return next();
  this.password = await hash(this.password, 12);
  return next();
});

// Pre-remove middleware to cleanup friendships
userSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Friendship = mongoose.model('Friendship');
    await Friendship.deleteMany({
      $or: [
        { requester: this._id },
        { recipient: this._id }
      ]
    });
    console.log(`Cleaned up friendships for deleted user: ${this.username}`);
    next();
  } catch (error) {
    next(error);
  }
});

// Also handle findOneAndDelete
userSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const Friendship = mongoose.model('Friendship');
    await Friendship.deleteMany({
      $or: [
        { requester: doc._id },
        { recipient: doc._id }
      ]
    });
    console.log(`Cleaned up friendships for deleted user: ${doc.username}`);
  }
});


userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.invalidateAllTokens = async function () {
  this.tokenInvalidatedAt = new Date();
  await this.save();
};

export default mongoose.model("User", userSchema);

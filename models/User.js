import mongoose from "mongoose";
import bcrypt, { hash } from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "../public/images/user-solid.svg" },
  status: {
    type: String,
    enum: ["online", "offline", "in match"],
    default: "offline",
  },
  lastSeen: { type: Date, default: Date.now },
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
},{timestamps: true });

userSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();
  if(!this.isModified('password')) return next();
  this.password = await hash(this.password, 12);
  return next();
});


userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
}

export default mongoose.model("User", userSchema);



import mongoose from "mongoose";

const wordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  hint: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ["animals", "food", "technology", "sports", "movies", "general"],
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    required: true,
  },
  length: {
    type: Number,
    required: true,
  },
  language: {
    type: String,
    enum: ["en", "ar", "zh", "de", "es", "fr"],
    default: "en",
    required: true,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  averageGuessTime: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
wordSchema.index({ language: 1, length: 1, difficulty: 1 });
wordSchema.index({ word: 1 });

// Method to increment usage count
wordSchema.methods.incrementUsage = async function () {
  this.usageCount += 1;
  await this.save();
};

// Method to update success rate
wordSchema.methods.updateSuccessRate = async function (wasGuessed) {
  const totalGames = this.usageCount;
  if (totalGames === 0) return;

  const currentSuccesses = Math.round((this.successRate / 100) * totalGames);
  const newSuccesses = wasGuessed ? currentSuccesses + 1 : currentSuccesses;
  this.successRate = (newSuccesses / totalGames) * 100;
  
  await this.save();
};

export default mongoose.model("WordBank", wordSchema);
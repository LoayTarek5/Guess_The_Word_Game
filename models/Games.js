const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  players: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    score: { type: Number, default: 0 },
    wordsGuessed: { type: Number, default: 0 },
    averageGuessTime: { type: Number, default: 0 },
    isReady: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
  }],
  
  // Game Settings
  gameSettings: {
    maxPlayers: { type: Number, default: 2 },
    roundsToWin: { type: Number, default: 3 },
    timePerRound: { type: Number, default: 60 }, // seconds
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    category: { type: String, default: 'general' }
  },
  
  // Game State
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'completed', 'abandoned'],
    default: 'waiting'
  },
  
  currentRound: { type: Number, default: 1 },
  currentTurn: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
  // Current word info
  currentWord: {
    word: String,
    hint: String,
    category: String,
    difficulty: String,
    guessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guessTime: Number,
    attempts: Number
  },
  
  // Game History
  rounds: [{
    roundNumber: Number,
    word: String,
    hint: String,
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guessTime: Number,
    attempts: Number,
    completedAt: Date
  }],
  
  // Final Results
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalScores: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: Number,
    wordsGuessed: Number,
    averageTime: Number
  }],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware
gameSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Game', gameSchema);
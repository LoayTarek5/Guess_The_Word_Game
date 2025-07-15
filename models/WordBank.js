const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  word: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true
  },
  hint: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: ['animals', 'food', 'technology', 'sports', 'movies', 'general']
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  length: { 
    type: Number, 
    required: true 
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  successRate: { 
    type: Number, 
    default: 0 
  },
  averageGuessTime: { 
    type: Number, 
    default: 0 
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Word', wordSchema);
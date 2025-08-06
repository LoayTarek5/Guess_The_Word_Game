const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  game: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Game', 
    required: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  message: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['text', 'system', 'emoji', 'hint'],
    default: 'text'
  },
  timestamp: { type: Date, default: Date.now },
  isRead: [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
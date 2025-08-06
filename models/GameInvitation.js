const mongoose = require('mongoose');

const gameInvitationSchema = new mongoose.Schema({
  from: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  to: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  game: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Game' 
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending'
  },
  message: { 
    type: String, 
    maxlength: 200 
  },
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: Date
});

// Auto-expire invitations
gameInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GameInvitation', gameInvitationSchema);
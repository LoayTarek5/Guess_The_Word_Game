const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: {
    type: String,
    enum: ['friend_request', 'friend_accepted', 'game_invitation', 'game_completed', 'achievement'],
    required: true
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  data: {
    type: mongoose.Schema.Types.Mixed // For additional data like user IDs, game IDs, etc.
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
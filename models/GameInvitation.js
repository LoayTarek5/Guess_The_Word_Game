import mongoose from "mongoose";

const gameInvitationSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
  },
  gameId: {
    type: String, // Match your Game schema's gameId
    index: true,
  },
  gameSettings: {
    maxPlayers: { type: Number, min: 2, max: 4 },
    roundsToWin: { type: Number, min: 1, max: 10 },
    timePerRound: { type: Number, min: 30, max: 300 }, // 30 seconds to 5 minutes
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"], // Match your Game schema
      default: "medium",
    },
    category: { type: String, default: "general" },
  },
  gameState: {
    playersCount: { type: Number, default: 1 },
    spotsAvailable: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "expired"],
    default: "pending",
  },
  message: {
    type: String,
    maxlength: 200,
    trim: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  respondedAt: Date,
  seenAt: Date,
  retryCount: {
    type: Number,
    default: 0,
    max: 2,
  },
});

// Indexes optimized for your game flow
gameInvitationSchema.index({ to: 1, status: 1, createdAt: -1 }); 
gameInvitationSchema.index({ from: 1, createdAt: -1 }); 
gameInvitationSchema.index({ game: 1, status: 1 }); 
gameInvitationSchema.index({ gameId: 1, status: 1 }); // For gameId lookups
gameInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
gameInvitationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending' && !this.respondedAt) {
    this.respondedAt = new Date();
  }
  next();
});

gameInvitationSchema.virtual('isActive').get(function() {
  return this.status === 'pending' && this.expiresAt > new Date();
});

gameInvitationSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'pending') return 0;
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

gameInvitationSchema.methods.accept = async function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is no longer pending');
  }
  if (this.expiresAt < new Date()) {
    this.status = 'expired';
    await this.save();
    throw new Error('Invitation has expired');
  }
  
  // Check if game is still accepting players
  const Game = mongoose.model('Game');
  const game = await Game.findById(this.game);
  
  if (!game || game.status !== 'waiting') {
    throw new Error('Game is no longer accepting players');
  }
  
  if (game.players.length >= game.gameSettings.maxPlayers) {
    throw new Error('Game is full');
  }
  
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

gameInvitationSchema.methods.decline = function() {
  if (this.status !== 'pending') {
    throw new Error('Invitation is no longer pending');
  }
  
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

gameInvitationSchema.statics.findActiveForUser = function(userId) {
  return this.find({
    to: userId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('from', 'username avatar')
  .populate('game', 'gameId status gameSettings players')
  .sort({ createdAt: -1 });
};

export default mongoose.model("GameInvitation", gameInvitationSchema);

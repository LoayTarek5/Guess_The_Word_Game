import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minLength: 6,
    maxLength: 6,
  },
  roomName: {
    type: String,
    default: "Untitled Room",
    maxLength: 50,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  settings: {
    wordLength: {
      type: Number,
      required: true,
      enum: [4, 5, 6, 7],
      default: 5,
    },
    maxPlayers: {
      type: Number,
      required: true,
      enum: [2, 3, 4],
      default: 2,
    },
    language: {
      type: String,
      required: true,
      enum: ["en", "ar", "zh", "de", "es", "fr"],
      default: "en",
    },
    maxTries: {
      type: Number,
      required: true,
      enum: [4, 5, 6, 7, 8],
      default: 6,
    },
    difficulty: {
      type: String,
      enum: ["easy", "normal", "classic", "hard", "expert", "custom"],
      default: "classic",
    },
  },
  status: {
    type: String,
    enum: ["waiting", "full", "in-game", "finished", "closed"],
    default: "waiting",
  },
  players: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      isReady: {
        type: Boolean,
        default: false,
      },
      isHost: {
        type: Boolean,
        default: false,
      },
    },
  ],
  currentGame: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: function () {
      return new Date(Date.now() + 15 * 60 * 1000);
    },
  },
});

roomSchema.index({ roomCode: 1 });
roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

roomSchema.virtual("currentPlayers").get(function () {
  return this.players.length;
});

roomSchema.virtual("isFull").get(function () {
  return this.players.length >= this.settings.maxPlayers;
});

roomSchema.methods.addPlayer = function (userId) {
  if (this.isFull) {
    throw new Error("Room is full");
  }

  const existingPlayer = this.players.find(
    (p) => p.user.toString() === userId.toString()
  );
  if (existingPlayer) {
    throw new Error("Player already in room");
  }

  const isHost = this.players.length === 0;
  this.players.push({
    user: userId,
    isHost: isHost,
  });

  if (this.players.length === this.settings.maxPlayers) {
    this.status = "full";
  }

  this.lastActivity = Date.now();
  return this.save();
};

roomSchema.methods.getPlayer = function (userId) {
  return this.players.find((p) => p.user.toString() === userId.toString());
};

roomSchema.methods.isHost = function (userId) {
  const player = this.getPlayer(userId);
  return player ? player.isHost : false;
};

roomSchema.methods.exitRoom = async function (userId) {
  const player = this.getPlayer(userId);

  if (!player) {
    throw new Error("Player not in room");
  }

  const wasHost = player.isHost;
  const playerCount = this.players.length;

  // Remove the player
  this.players = this.players.filter(
    (p) => p.user.toString() !== userId.toString()
  );

  // Handle different scenarios after player exits
  if (this.players.length === 0) {
    // Last player left - close the room
    this.status = "closed";
  } else {
    // Room still has players
    if (wasHost) {
      // Assign new host (oldest player becomes host)
      this.players[0].isHost = true;
    }

    // Update room status based on game state
    if (this.status === "in-game") {
      // Handle in-game exit
      if (this.players.length < 2) {
        // Not enough players to continue
        this.status = "finished";
      }
    } else if (this.status === "full") {
      // Room no longer full
      this.status = "waiting";
    }
  }

  this.lastActivity = Date.now();

  await this.save();
  await this.populate("players.user", "username avatar");

  return {
    roomStatus: this.status,
    newHost: wasHost && this.players.length > 0 ? this.players[0].user : null,
    remainingPlayers: this.players.length,
  };
};

roomSchema.methods.getDifficultyLabel = function () {
  const { wordLength, maxTries } = this.settings;

  // Calculate difficulty based on word length and max tries
  const difficultyScore = wordLength * 2 + (9 - maxTries);

  if (difficultyScore <= 11) return "Beginner";
  if (difficultyScore <= 13) return "Easy";
  if (difficultyScore <= 15) return "Classic";
  if (difficultyScore <= 17) return "Hard";
  return "Expert";
};

roomSchema.statics.generateRoomCode = async function () {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existing = await this.findOne({ roomCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

roomSchema.pre("save", function (next) {
  this.lastActivity = Date.now();
  next();
});

export default mongoose.model("Room", roomSchema);

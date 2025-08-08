// testGameSeeder.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Define schemas inline to avoid import issues
const userSchema = new mongoose.Schema({
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
}, { timestamps: true });

const gameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true,
  },
  players: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      score: { type: Number, default: 0 },
      wordsGuessed: { type: Number, default: 0 },
      averageGuessTime: { type: Number, default: 0 },
      isReady: { type: Boolean, default: false },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  gameSettings: {
    maxPlayers: { type: Number, default: 2 },
    roundsToWin: { type: Number, default: 3 },
    timePerRound: { type: Number, default: 60 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    category: { type: String, default: "general" },
  },
  status: {
    type: String,
    enum: ["waiting", "active", "paused", "completed", "abandoned"],
    default: "waiting",
  },
  currentRound: { type: Number, default: 1 },
  currentTurn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  currentWord: {
    word: String,
    hint: String,
    category: String,
    difficulty: String,
    guessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guessTime: Number,
    attempts: Number,
  },
  rounds: [
    {
      roundNumber: Number,
      word: String,
      hint: String,
      winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      guessTime: Number,
      attempts: Number,
      completedAt: Date,
    },
  ],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  finalScores: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      score: Number,
      wordsGuessed: Number,
      averageTime: Number,
    },
  ],
  // Additional fields for your frontend
  targetWord: String,
  word: String,
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);

// Sample words for different difficulties
const WORDS_BY_DIFFICULTY = {
  easy: [
    { word: 'CAT', hint: 'A furry pet that meows', category: 'animals' },
    { word: 'DOG', hint: 'Man\'s best friend', category: 'animals' },
    { word: 'SUN', hint: 'Bright star in our solar system', category: 'nature' },
    { word: 'BOOK', hint: 'You read this', category: 'objects' },
    { word: 'TREE', hint: 'Tall plant with branches', category: 'nature' },
    { word: 'FISH', hint: 'Swims in water', category: 'animals' },
    { word: 'MOON', hint: 'Shines at night', category: 'nature' },
    { word: 'BALL', hint: 'Round toy you can throw', category: 'objects' }
  ],
  medium: [
    { word: 'COMPUTER', hint: 'Electronic device for processing data', category: 'technology' },
    { word: 'GUITAR', hint: 'Six-stringed musical instrument', category: 'music' },
    { word: 'PIZZA', hint: 'Italian dish with cheese and toppings', category: 'food' },
    { word: 'RAINBOW', hint: 'Colorful arc in the sky after rain', category: 'nature' },
    { word: 'BUTTERFLY', hint: 'Colorful insect with large wings', category: 'animals' },
    { word: 'MOUNTAIN', hint: 'Very tall natural elevation', category: 'nature' },
    { word: 'TELEPHONE', hint: 'Device used for long-distance communication', category: 'technology' },
    { word: 'ELEPHANT', hint: 'Large gray animal with a trunk', category: 'animals' }
  ],
  hard: [
    { word: 'ENCYCLOPEDIA', hint: 'Comprehensive reference work', category: 'education' },
    { word: 'PHILOSOPHY', hint: 'Study of fundamental nature of reality', category: 'education' },
    { word: 'ARCHITECTURE', hint: 'Art and science of designing buildings', category: 'profession' },
    { word: 'MICROSCOPE', hint: 'Instrument for viewing very small objects', category: 'science' },
    { word: 'ORCHESTRA', hint: 'Large ensemble of musicians', category: 'music' },
    { word: 'LABORATORY', hint: 'Facility equipped for scientific experiments', category: 'science' },
    { word: 'MATHEMATICS', hint: 'Science of numbers and shapes', category: 'education' },
    { word: 'PSYCHOLOGY', hint: 'Study of mind and behavior', category: 'education' }
  ]
};

// Utility functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomDate(monthsBack) {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setMonth(now.getMonth() - monthsBack);
  
  const randomTime = pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime());
  return new Date(randomTime);
}

function getRandomGameDuration() {
  return Math.floor(Math.random() * 10 + 5) * 60 * 1000; // 5-15 minutes
}

function getRandomGuessTime() {
  return Math.floor(Math.random() * 170 + 10); // 10-180 seconds
}

function getRandomAttempts() {
  return Math.floor(Math.random() * 8 + 1);
}

async function seedGameData() {
  try {
    console.log('🌱 Starting game data seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    if (users.length < 1) {
      console.log('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    // If only one user, create a test opponent
    if (users.length < 2) {
      console.log('📝 Creating test opponent...');
      
      const testOpponent = new User({
        username: 'TestBot',
        email: 'testbot@example.com',
        password: 'password123',
        stats: {
          totalGames: 25,
          gamesWon: 12,
          gamesLost: 10,
          gamesDraw: 3,
          winStreak: 2,
          bestStreak: 5,
          level: 3,
          experience: 750
        }
      });
      
      await testOpponent.save();
      users.push(testOpponent);
      console.log('✅ Created test opponent');
    }

    // Clear existing games (optional)
    const existingGamesCount = await Game.countDocuments();
    if (existingGamesCount > 0) {
      console.log(`🗑️ Found ${existingGamesCount} existing games. Clearing...`);
      await Game.deleteMany({});
      console.log('✅ Cleared existing games');
    }

    const currentUser = users[0]; // First user
    const opponents = users.slice(1); // Other users as opponents

    const gamesToCreate = 35;
    console.log(`🎮 Creating ${gamesToCreate} test games for user: ${currentUser.username}`);

    const games = [];

    for (let i = 0; i < gamesToCreate; i++) {
      const opponent = getRandomElement(opponents);
      const difficulty = getRandomElement(['easy', 'medium', 'hard']);
      const wordData = getRandomElement(WORDS_BY_DIFFICULTY[difficulty]);
      
      // Generate outcome: 45% win, 30% lose, 25% draw
      const outcomeRoll = Math.random();
      let winner = null;
      let currentUserScore = 0;
      let opponentScore = 0;

      if (outcomeRoll < 0.45) {
        // Current user wins
        winner = currentUser._id;
        currentUserScore = Math.floor(Math.random() * 3 + 3); // 3-5 points
        opponentScore = Math.floor(Math.random() * currentUserScore); // 0 to currentUserScore-1
      } else if (outcomeRoll < 0.75) {
        // Opponent wins
        winner = opponent._id;
        opponentScore = Math.floor(Math.random() * 3 + 3); // 3-5 points
        currentUserScore = Math.floor(Math.random() * opponentScore); // 0 to opponentScore-1
      } else {
        // Draw
        const drawScore = Math.floor(Math.random() * 3 + 2); // 2-4 points each
        currentUserScore = drawScore;
        opponentScore = drawScore;
      }

      const completedAt = getRandomDate(6); // Games within last 6 months
      const gameDuration = getRandomGameDuration();
      const startedAt = new Date(completedAt.getTime() - gameDuration);

      const game = {
        gameId: `test_game_${Date.now()}_${i}`,
        players: [
          {
            user: currentUser._id,
            score: currentUserScore,
            wordsGuessed: currentUserScore,
            averageGuessTime: getRandomGuessTime(),
            isReady: true,
            joinedAt: startedAt
          },
          {
            user: opponent._id,
            score: opponentScore,
            wordsGuessed: opponentScore,
            averageGuessTime: getRandomGuessTime(),
            isReady: true,
            joinedAt: startedAt
          }
        ],
        gameSettings: {
          maxPlayers: 2,
          roundsToWin: 5,
          timePerRound: 60,
          difficulty: difficulty,
          category: wordData.category
        },
        status: 'completed',
        currentRound: Math.max(currentUserScore, opponentScore) || 1,
        currentWord: {
          word: wordData.word,
          hint: wordData.hint,
          category: wordData.category,
          difficulty: difficulty,
          guessedBy: winner,
          guessTime: getRandomGuessTime(),
          attempts: getRandomAttempts()
        },
        rounds: [
          {
            roundNumber: 1,
            word: wordData.word,
            hint: wordData.hint,
            winner: winner,
            guessTime: getRandomGuessTime(),
            attempts: getRandomAttempts(),
            completedAt: completedAt
          }
        ],
        winner: winner,
        finalScores: [
          {
            user: currentUser._id,
            score: currentUserScore,
            wordsGuessed: currentUserScore,
            averageTime: getRandomGuessTime()
          },
          {
            user: opponent._id,
            score: opponentScore,
            wordsGuessed: opponentScore,
            averageTime: getRandomGuessTime()
          }
        ],
        // Additional fields your frontend expects
        targetWord: wordData.word,
        word: wordData.word,
        createdAt: startedAt,
        startedAt: startedAt,
        completedAt: completedAt,
        updatedAt: completedAt
      };

      games.push(game);
    }

    // Insert all games
    console.log('💾 Inserting games into database...');
    const insertedGames = await Game.insertMany(games);
    console.log(`✅ Successfully created ${insertedGames.length} games`);

    // Update user stats
    console.log('📊 Updating user statistics...');
    const userGames = insertedGames;

    const wins = userGames.filter(game => 
      game.winner && game.winner.toString() === currentUser._id.toString()
    ).length;

    const losses = userGames.filter(game => 
      game.winner && game.winner.toString() !== currentUser._id.toString()
    ).length;

    const draws = userGames.filter(game => !game.winner).length;

    const userStats = {
      totalGames: userGames.length,
      gamesWon: wins,
      gamesLost: losses,
      gamesDraw: draws,
      winStreak: Math.floor(Math.random() * 5 + 1),
      bestStreak: Math.floor(Math.random() * 8 + 5),
      totalWordsGuessed: userGames.reduce((total, game) => {
        const userPlayer = game.players.find(p => p.user.toString() === currentUser._id.toString());
        return total + (userPlayer ? userPlayer.wordsGuessed : 0);
      }, 0),
      averageGuessTime: Math.floor(Math.random() * 60 + 30),
      level: Math.floor(wins / 5) + 1, // Level up every 5 wins
      experience: wins * 50 + draws * 15
    };

    await User.findByIdAndUpdate(currentUser._id, { 
      $set: { stats: userStats }
    });

    console.log('\n📊 Seeding Summary:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 User: ${currentUser.username}`);
    console.log(`🎮 Total games: ${userStats.totalGames}`);
    console.log(`🏆 Games won: ${userStats.gamesWon} (${((userStats.gamesWon/userStats.totalGames)*100).toFixed(1)}%)`);
    console.log(`😔 Games lost: ${userStats.gamesLost}`);
    console.log(`🤝 Games drawn: ${userStats.gamesDraw}`);
    console.log(`📈 Current level: ${userStats.level}`);
    console.log(`⚡ Experience: ${userStats.experience}`);

    // Show monthly distribution
    const monthlyStats = {};
    userGames.forEach(game => {
      const month = game.completedAt.toLocaleDateString('en-US', { month: 'short' });
      if (!monthlyStats[month]) {
        monthlyStats[month] = { wins: 0, losses: 0, draws: 0 };
      }
      
      if (game.winner) {
        if (game.winner.toString() === currentUser._id.toString()) {
          monthlyStats[month].wins++;
        } else {
          monthlyStats[month].losses++;
        }
      } else {
        monthlyStats[month].draws++;
      }
    });

    console.log('\n📅 Monthly Performance:');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Object.entries(monthlyStats)
      .sort(([a], [b]) => new Date(`${a} 1, 2024`) - new Date(`${b} 1, 2024`))
      .forEach(([month, stats]) => {
        const total = stats.wins + stats.losses + stats.draws;
        const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : 0;
        console.log(`${month.padEnd(3)}: ${String(stats.wins).padStart(2)}W ${String(stats.losses).padStart(2)}L ${String(stats.draws).padStart(2)}D (${winRate}% win rate)`);
      });

    console.log('\n🎉 Game data seeding completed successfully!');
    console.log('📱 You can now refresh your dashboard to see:');
    console.log('   ✅ Updated match history');
    console.log('   ✅ Performance chart with monthly data');
    console.log('   ✅ Updated user statistics');

  } catch (error) {
    console.error('❌ Error seeding game data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeder
seedGameData();
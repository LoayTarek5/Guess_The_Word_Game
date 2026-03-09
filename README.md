# 🎮 Guess The Word Game

A real-time multiplayer word guessing game platform built with Node.js, Express, Socket.io, and MongoDB. Players compete in interactive game rooms, challenge friends, track statistics, and engage in live chat during gameplay.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Socket Events](#socket-events)
- [Key Models](#key-models)
- [Scripts](#scripts)
- [Security Features](#security-features)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### User Management
- User registration and authentication with password hashing (bcryptjs)
- JWT-based session management
- User profiles with avatars
- Real-time user status tracking (online/offline/in match)
- Last seen timestamp

### Gameplay
- Real-time multiplayer word guessing matches
- Multiple game rooms/lobbies
- Competitive scoring system
- Player readiness tracking
- Live game state synchronization

### Social Features
- Friend system with add/remove functionality
- Game invitations to friends
- Real-time notifications
- Live chat during gameplay
- Friend activity tracking

### Statistics & Analytics
- Comprehensive player statistics:
  - Total games played
  - Games won/lost/drawn
  - Win streaks and best streaks
  - Total words guessed
  - Average guess time
  - Total score
- Match history with detailed game records
- Performance metrics and analytics

### Real-time Communication
- WebSocket-based real-time updates via Socket.io
- Live game events
- Instant notifications
- Chat messaging
- User status updates

## 📁 Project Structure

```
Guess_The_Word_Game/
├── controllers/           # Business logic handlers
│   ├── authController.js
│   ├── friendController.js
│   ├── gameController.js
│   ├── notificationController.js
│   └── roomController.js
├── routes/               # API and page route definitions
│   ├── auth.js
│   ├── dashboard.js
│   ├── friendsApi.js
│   ├── friendsPage.js
│   ├── gameLobbyPage.js
│   ├── gameplayRoute.js
│   ├── matchHistoryApi.js
│   ├── matchHistoryPage.js
│   ├── notificationsApi.js
│   ├── notificationsPage.js
│   ├── roomApi.js
│   └── roomPage.js
├── models/               # MongoDB schemas
│   ├── User.js
│   ├── Games.js
│   ├── Room.js
│   ├── Friendship.js
│   ├── GameInvitation.js
│   ├── Notification.js
│   ├── ChatMessage.js
│   └── WordBank.js
├── socket/               # WebSocket server and handlers
│   ├── socketServer.js
│   ├── socketAuth.js
│   └── handlers/
│       ├── gameHandler.js
│       ├── chatHandler.js
│       ├── notificationHandler.js
│       ├── roomHandler.js
│       └── userStatusHandler.js
├── middleware/           # Express middleware
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   ├── routeGuards.js
│   └── validation.js
├── utils/                # Utility functions
│   ├── logger.js         # Winston-based logging
│   └── wordManager.js
├── public/               # Client-side assets
│   ├── js/              # JavaScript files
│   ├── style/           # CSS stylesheets
│   └── images/          # Images
├── views/                # EJS templates
│   ├── layouts/         # Layout templates
│   ├── auth/            # Authentication pages
│   └── *.ejs            # Page templates
├── scripts/              # Database seeding scripts
│   ├── createTestGames.js
│   ├── createTestFriends.js
│   └── createTestNotifications.js
├── logs/                 # Application logs
├── server.js             # Main server file
├── docker-compose.yml    # Docker configuration
├── package.json          # Project dependencies
└── friends-api.http      # HTTP request examples
```

## 🛠 Technology Stack

- **Backend Framework:** Express.js (v5.1.0)
- **Real-time Communication:** Socket.io (v4.8.1)
- **Database:** MongoDB (v8.16.1) with Mongoose ODM
- **Authentication:** JWT & bcryptjs
- **Template Engine:** EJS with Express Layouts
- **Security:** Helmet.js, CORS, Rate Limiting, Express Validator
- **Session Management:** Express Session with MongoDB store
- **Logging:** Winston
- **Frontend:** Vanilla JavaScript, CSS3
- **DevOps:** Docker & Docker Compose

### Key Dependencies

```json
{
  "express": "^5.1.0",
  "socket.io": "^4.8.1",
  "mongoose": "^8.16.1",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^3.0.2",
  "helmet": "^8.1.0",
  "express-validator": "^7.2.1",
  "winston": "^3.17.0",
  "chart.js": "^4.5.0"
}
```

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MongoDB (v5.0 or higher)
- Docker & Docker Compose (optional, for containerized setup)

### Clone the Repository
```bash
git clone https://github.com/LoayTarek5/Guess_The_Word_Game.git
cd Guess_The_Word_Game
```

### Install Dependencies
```bash
npm install
```

## ⚙️ Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://admin:admin@mongodb:27017/guess_the_word_game?authSource=admin

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d

# Session
SESSION_SECRET=your_session_secret_here

# Client Configuration
CLIENT_URL=http://localhost:3000

# Email (if applicable)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password

# Game Configuration
WORDS_PER_GAME=5
GAME_DURATION=300
MAX_PLAYERS_PER_ROOM=100
```

## 🚀 Running the Application

### Development Mode (with file watching)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Using Docker Compose
```bash
docker-compose up
```

The application will be available at `http://localhost:3000`

## 🗄️ Database Setup

### Using Docker Compose (Recommended)
```bash
docker-compose up
```

This starts:
- MongoDB on port 27017
- Mongo Express (admin UI) on port 8081

Access Mongo Express at `http://localhost:8081`

### Manual MongoDB Setup
```bash
# Start MongoDB locally
mongod

# Connect to MongoDB
mongo
```

### Database Initialization

The application automatically connects to MongoDB on startup. Use the seeding scripts to populate test data:

```bash
# Seed test games
npm run seedGames

# Seed test friends
npm run seedFriends

# Seed test notifications
npm run seedNotifications
```

## 📡 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register a new user
- `POST /login` - Login user
- `POST /logout` - Logout user
- `GET /me` - Get current user profile

### Friends (`/api/friends`)
- `GET /` - Get user's friends list
- `POST /add/:userId` - Send friend request
- `DELETE /remove/:userId` - Remove friend
- `GET /requests` - Get pending friend requests
- `POST /requests/:userId/accept` - Accept friend request

### Games (`/api/games`)
- `GET /` - Get game history
- `GET /:gameId` - Get specific game details
- `POST /create` - Create new game
- `POST /:gameId/join` - Join a game
- `POST /:gameId/guess` - Submit guess during gameplay

### Rooms (`/api/rooms`)
- `GET /` - List available game rooms
- `POST /create` - Create new room
- `GET /:roomId` - Get room details
- `POST /:roomId/join` - Join room
- `POST /:roomId/leave` - Leave room

### Match History (`/api/match-history`)
- `GET /` - Get user's match history
- `GET /:matchId` - Get detailed match information

### Notifications (`/api/notifications`)
- `GET /` - Get user notifications
- `POST /:notificationId/read` - Mark notification as read
- `DELETE /:notificationId` - Delete notification

## 🔌 Socket Events

### Connection Events
- `connect` - User connects to WebSocket
- `disconnect` - User disconnects
- `user:status` - Broadcast user status change

### Game Events
- `game:start` - Game session starts
- `game:guess-submitted` - Player submits a guess
- `game:update-state` - Update game state to all players
- `game:end` - Game concludes
- `game:player-ready` - Player marks as ready

### Chat Events
- `chat:send-message` - Send message in game chat
- `chat:receive-message` - Receive messages from other players
- `chat:typing` - User typing indicator

### Room Events
- `room:create` - Create new room
- `room:join` - Player joins room
- `room:leave` - Player leaves room
- `room:update` - Room state update

### Notification Events
- `notification:send` - Send notification
- `notification:receive` - Receive notification
- `notification:update` - Update notification status

### User Status Events
- `user:online` - User comes online
- `user:offline` - User goes offline
- `user:in-match` - User starts playing

## 📊 Key Models

### User
```javascript
{
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  avatar: String,
  currentRoomId: String,
  status: enum ["online", "offline", "in match"],
  lastSeen: Date,
  stats: {
    totalGames: Number,
    gamesWon: Number,
    gamesLost: Number,
    gamesDraw: Number,
    winStreak: Number,
    bestStreak: Number,
    totalWordsGuessed: Number,
    averageGuessTime: Number,
    totalScore: Number
  }
}
```

### Games
```javascript
{
  gameId: String (unique),
  roomId: String,
  players: [{ user: ObjectId, score: Number, attempts: Number, ... }],
  status: String,
  startedAt: Date,
  endedAt: Date,
  winner: ObjectId
}
```

### Room
```javascript
{
  roomId: String (unique),
  name: String,
  creator: ObjectId,
  players: [ObjectId],
  capacity: Number,
  status: String,
  createdAt: Date
}
```

### Friendship
```javascript
{
  requester: ObjectId,
  receiver: ObjectId,
  status: enum ["pending", "accepted", "blocked"],
  createdAt: Date
}
```

## 🧪 Scripts

### Utility Scripts
Located in `/scripts/` directory:

- **createTestGames.js** - Creates sample game records for testing
- **createTestFriends.js** - Sets up test friendships between users
- **createTestNotifications.js** - Generates test notifications

Run any script with:
```bash
npm run seed[ScriptName]
```

## 🔒 Security Features

- **Helmet.js** - Sets security HTTP headers
- **CORS** - Cross-Origin Resource Sharing protection
- **Rate Limiting** - Prevents brute force attacks
- **Input Validation** - Express Validator middleware
- **Password Hashing** - bcryptjs with salt rounds
- **JWT Authentication** - Secure token-based auth
- **Content Security Policy** - Restricts resource loading
- **Session Security** - Secure session management with MongoDB store
- **XSS Protection** - Built-in protection through templating

## 👨‍💻 Development

### File Watching
```bash
npm run dev
```

### Linting (if configured)
```bash
npm run lint
```

### Building (if applicable)
```bash
npm run build
```

### Testing (if configured)
```bash
npm run test
```

## 📝 Making Requests

The `friends-api.http` file contains example HTTP requests for testing API endpoints. Use tools like:
- REST Client extension for VS Code
- Postman
- Thunder Client
- cURL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see LICENSE file for details.

## 🔗 Links

- **Repository:** [GitHub - Guess_The_Word_Game](https://github.com/LoayTarek5/Guess_The_Word_Game)
- **Issues:** [Report Issues](https://github.com/LoayTarek5/Guess_The_Word_Game/issues)

## 📞 Support

For issues, questions, or suggestions, please:
1. Check existing GitHub issues
2. Open a new issue with detailed description
3. Include steps to reproduce bugs
4. Provide environment details (Node version, OS, etc.)

---

**Last Updated:** 2026-03-09  
**Version:** 1.0.0  
**Author:** [LoayTarek5](https://github.com/LoayTarek5)
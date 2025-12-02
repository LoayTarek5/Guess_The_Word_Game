import { getIO, getUserSocketId } from "../socketServer.js";
import Room from "../../models/Room.js";
import Game from "../../models/Games.js";
import logger from "../../utils/logger.js";

export const setupGameHandlers = (socket) => {
  logger.info(
    `Setting up game handlers for socket: ${socket.id}, user: ${socket.userId}`
  );
  socket.on("game:requestState", async (data) => {
    try {
      const { gameId } = data;
      const userId = socket.userId;

      const game = await Game.findOne({ gameId })
        .populate("players.user", "username avatar")
        .populate("currentTurn", "username avatar");

      if (!game) {
        return socket.emit("game:error", {
          message: "Game not found",
        });
      }

      // Verify user is in game
      const isPlayer = game.players.some(
        (p) => p.user._id.toString() === userId
      );

      if (!isPlayer) {
        return socket.emit("game:error", {
          message: "You are not in this game",
        });
      }

      // Prepare game state (hide the actual word)
      const gameState = {
        gameId: game.gameId,
        status: game.status,
        currentRound: game.currentRound,
        currentTurn: {
          userId: game.currentTurn._id,
          username: game.currentTurn.username,
          avatar: game.currentTurn.avatar,
        },
        wordLength: game.currentWord.word.length,
        maxTries: game.gameSettings.maxTries,
        currentAttempts: game.currentWord.attempts || 0,
        hint: game.currentWord.hint,
        category: game.currentWord.category,
        players: game.players.map((player) => ({
          userId: player.user._id,
          username: player.user.username,
          avatar: player.user.avatar,
          score: player.score,
          wordsGuessed: player.wordsGuessed,
          isCurrentTurn:
            player.user._id.toString() === game.currentTurn._id.toString(),
        })),
        settings: game.gameSettings,
        roundStartTime: game.startedAt,
      };

      socket.emit("game:stateUpdate", gameState);
    } catch (error) {
      logger.error("Error requesting game state:", error);
      socket.emit("game:error", {
        message: "Failed to get game state",
      });
    }
  });
};

export const emitGameStarted = (roomId, gameData) => {
  try {
    const io = getIO();
    io.to(`room:${roomId}`).emit("game:started", gameData);
    logger.info(`Game started event emitted for room: ${roomId}`);
  } catch (error) {
    logger.error("Error emitting game started:", error);
  }
};

export const emitGuessResult = (gameId, guessResult) => {
  try {
    const io = getIO();
    io.to(`game:${gameId}`).emit("game:guessResult", guessResult);
    logger.info(
      `Guess result emitted for game ${gameId}: ${guessResult.guess} - ${
        guessResult.isCorrect ? "Correct" : "Incorrect"
      }`
    );
  } catch (error) {
    logger.error("Error emitting guess result:", error);
  }
};

export const emitGameError = (target, errorMessage, isGame = false) => {
  try {
    const io = getIO();

    if (isGame) {
      io.to(`game:${target}`).emit("game:error", {
        message: errorMessage,
      });
    } else {
      // Target is userId
      const socketId = getUserSocketId(target);
      if (socketId) {
        io.to(socketId).emit("game:error", {
          message: errorMessage,
        });
      }
    }

    logger.error(`Game error emitted: ${errorMessage}`);
  } catch (err) {
    logger.error("Error emitting game error:", err);
  }
};

export const emitTurnChange = (gameId, turnData) => {
  try {
    const io = getIO();
    io.to(`game:${gameId}`).emit("game:turnChange", turnData);

    logger.info(
      `Turn changed in game ${gameId} to: ${turnData.username} (${turnData.currentTurn})`
    );
  } catch (error) {
    logger.error("Error emitting turn change:", error);
  }
};

export const emitRoundComplete = (gameId, roundResult) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:roundComplete", {
      ...roundResult,
      timestamp: new Date(),
    });

    logger.info(
      `Round ${roundResult.roundNumber} completed in game ${gameId}${
        roundResult.winner
          ? ` - Winner: ${roundResult.winner.username}`
          : " - No winner"
      }`
    );
  } catch (error) {
    logger.error("Error emitting round complete:", error);
  }
};

export const emitGameOver = (gameId, gameResult) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:over", {
      ...gameResult,
      timestamp: new Date(),
    });

    logger.info(
      `Game ${gameId} completed${
        gameResult.winner
          ? ` - Winner: ${gameResult.winner.username}`
          : " - Draw"
      }`
    );
  } catch (error) {
    logger.error("Error emitting game over:", error);
  }
};

export const emitTimerUpdate = (gameId, timeRemaining) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:timerUpdate", {
      timeRemaining,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error("Error emitting timer update:", error);
  }
};

export const emitTimeExpired = (gameId) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:timeExpired", {
      message: "Time's up!",
      timestamp: new Date(),
    });

    logger.info(`Time expired for game: ${gameId}`);
  } catch (error) {
    logger.error("Error emitting time expired:", error);
  }
};

export const emitPlayerDisconnected = (gameId, playerData) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:playerDisconnected", {
      userId: playerData.userId,
      username: playerData.username,
      timestamp: new Date(),
    });

    logger.info(
      `Player ${playerData.username} disconnected from game ${gameId}`
    );
  } catch (error) {
    logger.error("Error emitting player disconnected:", error);
  }
};

export const emitPlayerReconnected = (gameId, playerData) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:playerReconnected", {
      userId: playerData.userId,
      username: playerData.username,
      timestamp: new Date(),
    });

    logger.info(
      `Player ${playerData.username} reconnected to game ${gameId}`
    );
  } catch (error) {
    logger.error("Error emitting player reconnected:", error);
  }
};

export const emitScoreUpdate = (gameId, scores) => {
  try {
    const io = getIO();
    
    io.to(`game:${gameId}`).emit("game:scoreUpdate", {
      scores,
      timestamp: new Date(),
    });

    logger.info(`Score updated for game ${gameId}`);
  } catch (error) {
    logger.error("Error emitting score update:", error);
  }
};

export const broadcastToGame = (gameId, event, data, excludeUserId = null) => {
  const io = getIO();
  
  if (excludeUserId) {
    const socketId = getUserSocketId(excludeUserId);
    if (socketId) {
      io.to(`game:${gameId}`).except(socketId).emit(event, data);
    } else {
      io.to(`game:${gameId}`).emit(event, data);
    }
  } else {
    io.to(`game:${gameId}`).emit(event, data);
  }
};

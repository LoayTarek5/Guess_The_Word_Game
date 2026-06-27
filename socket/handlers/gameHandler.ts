import type { Socket } from "socket.io";
import { getIO, getUserSocketId } from "../socketServer.js";
import Game from "../../models/Games.js";
import logger from "../../utils/logger.js";
import gameController from "../../controllers/gameController.js";
import type {
  GameStartedPayload,
  GameStatePayload,
  GuessResultPayload,
  TurnChangePayload,
  RoundCompletePayload,
  GameOverPayload,
  ScoreUpdatePayload,
  PlayerConnectionPayload,
  JoinGamePayload,
  RequestStatePayload,
  SubmitGuessPayload,
} from "../../types/game.js";

/** A socket authenticated by socketAuth (carries the resolved userId). */
type GameSocket = Socket & { userId: string };

/** Build the client-facing game state (the target word is never included). */
const buildGameState = (game: any): GameStatePayload => ({
  gameId: game.gameId,
  status: game.status,
  currentRound: game.currentRound,
  currentTurn: {
    userId: game.currentTurn._id.toString(),
    username: game.currentTurn.username,
    avatar: game.currentTurn.avatar,
  },
  wordLength: game.currentWord.word.length,
  maxTries: game.gameSettings.maxTries,
  currentAttempts: game.currentWord.attempts || 0,
  hint: game.currentWord.hint,
  category: game.currentWord.category,
  players: game.players.map((player: any) => ({
    userId: player.user._id.toString(),
    username: player.user.username,
    avatar: player.user.avatar,
    score: player.score,
    wordsGuessed: player.wordsGuessed,
    isCurrentTurn:
      player.user._id.toString() === game.currentTurn._id.toString(),
  })),
  settings: game.gameSettings,
  roundStartTime: game.startedAt,
});

/** Load a game and confirm the requesting user is a participant. */
const loadGameForUser = async (
  gameId: string,
  userId: string
): Promise<{ game?: any; error?: string }> => {
  const game: any = await Game.findOne({ gameId })
    .populate("players.user", "username avatar")
    .populate("currentTurn", "username avatar");

  if (!game) return { error: "Game not found" };

  const isPlayer = game.players.some(
    (p: any) => p.user._id.toString() === userId
  );
  if (!isPlayer) return { error: "You are not in this game" };

  return { game };
};

export const setupGameHandlers = (socket: GameSocket): void => {
  logger.info(
    `Setting up game handlers for socket: ${socket.id}, user: ${socket.userId}`
  );

  // Join the game room so this socket receives game broadcasts, then send
  // the current state. Used when a player opens the gameplay page.
  socket.on("game:join", async (data: JoinGamePayload) => {
    try {
      const { game, error } = await loadGameForUser(data.gameId, socket.userId);
      if (error || !game) {
        return socket.emit("game:error", { message: error || "Game not found" });
      }

      socket.join(`game:${game.gameId}`);
      logger.info(`Socket ${socket.id} joined game room: ${game.gameId}`);
      socket.emit("game:stateUpdate", buildGameState(game));
    } catch (err) {
      logger.error("Error joining game:", err);
      socket.emit("game:error", { message: "Failed to join game" });
    }
  });

  socket.on("game:requestState", async (data: RequestStatePayload) => {
    try {
      const { game, error } = await loadGameForUser(data.gameId, socket.userId);
      if (error || !game) {
        return socket.emit("game:error", { message: error || "Game not found" });
      }
      socket.emit("game:stateUpdate", buildGameState(game));
    } catch (error) {
      logger.error("Error requesting game state:", error);
      socket.emit("game:error", { message: "Failed to get game state" });
    }
  });

  // Single real-time guess path. Validation, scoring and broadcasts all
  // happen inside processGuess; only the submitting socket needs an error.
  socket.on("game:submitGuess", async (data: SubmitGuessPayload) => {
    try {
      const result = await gameController.processGuess(
        data.gameId,
        socket.userId,
        data.guess
      );
      if (!result.ok) {
        socket.emit("game:error", { message: result.message });
      }
    } catch (error) {
      logger.error("Socket submit guess error:", error);
      socket.emit("game:error", { message: "Failed to submit guess" });
    }
  });
};

/** Join every connected player's socket to the game room when a game starts. */
export const addPlayersToGameRoom = (
  gameId: string,
  userIds: string[]
): void => {
  try {
    const io = getIO();
    for (const userId of userIds) {
      const socketId = getUserSocketId(userId);
      if (socketId) {
        io.sockets.sockets.get(socketId)?.join(`game:${gameId}`);
      }
    }
    logger.info(`Added players to game room: ${gameId}`);
  } catch (error) {
    logger.error("Error adding players to game room:", error);
  }
};

export const emitGameStarted = (
  roomId: string,
  gameData: GameStartedPayload
): void => {
  try {
    const io = getIO();
    io.to(`room:${roomId}`).emit("game:started", gameData);
    logger.info(`Game started event emitted for room: ${roomId}`);
  } catch (error) {
    logger.error("Error emitting game started:", error);
  }
};

export const emitGuessResult = (
  gameId: string,
  guessResult: GuessResultPayload
): void => {
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

export const emitGameError = (
  target: string,
  errorMessage: string,
  isGame = false
): void => {
  try {
    const io = getIO();

    if (isGame) {
      io.to(`game:${target}`).emit("game:error", { message: errorMessage });
    } else {
      // Target is userId
      const socketId = getUserSocketId(target);
      if (socketId) {
        io.to(socketId).emit("game:error", { message: errorMessage });
      }
    }

    logger.error(`Game error emitted: ${errorMessage}`);
  } catch (err) {
    logger.error("Error emitting game error:", err);
  }
};

export const emitTurnChange = (
  gameId: string,
  turnData: TurnChangePayload
): void => {
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

export const emitRoundComplete = (
  gameId: string,
  roundResult: RoundCompletePayload
): void => {
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

export const emitGameOver = (
  gameId: string,
  gameResult: GameOverPayload
): void => {
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

export const emitTimerUpdate = (
  gameId: string,
  timeRemaining: number
): void => {
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

export const emitTimeExpired = (gameId: string): void => {
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

export const emitPlayerDisconnected = (
  gameId: string,
  playerData: PlayerConnectionPayload
): void => {
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

export const emitPlayerReconnected = (
  gameId: string,
  playerData: PlayerConnectionPayload
): void => {
  try {
    const io = getIO();

    io.to(`game:${gameId}`).emit("game:playerReconnected", {
      userId: playerData.userId,
      username: playerData.username,
      timestamp: new Date(),
    });

    logger.info(`Player ${playerData.username} reconnected to game ${gameId}`);
  } catch (error) {
    logger.error("Error emitting player reconnected:", error);
  }
};

export const emitScoreUpdate = (
  gameId: string,
  scores: ScoreUpdatePayload["scores"]
): void => {
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

export const broadcastToGame = (
  gameId: string,
  event: string,
  data: unknown,
  excludeUserId: string | null = null
): void => {
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

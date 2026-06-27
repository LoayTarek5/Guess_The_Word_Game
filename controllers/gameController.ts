import type { Request, Response } from "express";
import User from "../models/User.js";
import Games from "../models/Games.js";
import Room from "../models/Room.js";
import logger from "../utils/logger.js";
import WordManager from "../utils/wordManager.js";
import {
  emitGuessResult,
  emitTurnChange,
  emitRoundComplete,
  emitGameOver,
} from "../socket/handlers/gameHandler.js";
import type {
  LetterFeedback,
  GuessResultPayload,
  RoundCompletePayload,
  RoundEndReason,
} from "../types/game.js";

/** Result of processing a single guess, shared by the REST and socket paths. */
export type ProcessGuessResult =
  | { ok: false; status: number; message: string }
  | {
      ok: true;
      guessResult: GuessResultPayload;
      roundComplete: boolean;
      roundResult?: RoundCompletePayload;
      nextTurn?: string;
    };

class GameController {
  async getGameState(req: Request, res: Response) {
    try {
      const { gameId } = req.params;
      const userId = (req as any).user.userId;

      const game: any = await Games.findOne({ gameId })
        .populate("players.user", "username avatar")
        .populate("currentTurn", "username avatar");

      if (!game) {
        return res.status(404).json({
          success: false,
          message: "Game not found",
        });
      }

      // Verify user is in game
      const isPlayer = game.players.some(
        (p: any) => p.user._id.toString() === userId
      );

      if (!isPlayer) {
        return res.status(403).json({
          success: false,
          message: "You are not in this game",
        });
      }

      // Prepare game state (hide the actual word)
      const gameState = {
        gameId: game.gameId,
        status: game.status,
        currentRound: game.currentRound,
        currentTurn: game.currentTurn,
        wordLength: game.currentWord.word.length,
        maxTries: game.gameSettings.maxTries,
        currentAttempts: game.currentWord.attempts || 0,
        players: game.players.map((player: any) => ({
          userId: player.user._id,
          username: player.user.username,
          avatar: player.user.avatar,
          score: player.score,
          wordsGuessed: player.wordsGuessed,
          isCurrentTurn:
            player.user._id.toString() === game.currentTurn._id.toString(),
        })),
        settings: game.gameSettings,
        timeRemaining: this.calculateTimeRemaining(game),
      };

      res.json({
        success: true,
        gameState,
      });
    } catch (error) {
      logger.error("Get game state error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get game state",
      });
    }
  }

  calculateTimeRemaining(game: any): number {
    if (!game.startedAt) return 0;

    const elapsed = Date.now() - new Date(game.startedAt).getTime();
    const timeLimit = game.gameSettings.timePerRound * 1000; // Convert to ms
    const remaining = Math.max(0, timeLimit - elapsed);

    return Math.floor(remaining / 1000); // Return in seconds
  }

  /**
   * Core guess pipeline: validate, score, persist, and broadcast over the
   * game room. Used by both the REST route and the socket handler so there
   * is a single source of truth for guess handling.
   */
  async processGuess(
    gameId: string,
    userId: string,
    guess: string
  ): Promise<ProcessGuessResult> {
    logger.info(`User ${userId} submitting guess: ${guess} for game: ${gameId}`);

    const game: any = await Games.findOne({ gameId }).populate(
      "players.user",
      "username avatar"
    );

    if (!game) {
      return { ok: false, status: 404, message: "Game not found" };
    }

    if (game.status !== "active") {
      return { ok: false, status: 400, message: "Game is not active" };
    }

    const player = game.players.find(
      (p: any) => p.user._id.toString() === userId
    );

    if (!player) {
      return { ok: false, status: 403, message: "You are not in this game" };
    }

    if (game.currentTurn.toString() !== userId) {
      return { ok: false, status: 403, message: "Not your turn" };
    }

    if (!guess || typeof guess !== "string") {
      return { ok: false, status: 400, message: "Invalid guess" };
    }

    const guessedWord = guess.toUpperCase().trim();
    const expectedLength = game.currentWord.word.length;
    if (guessedWord.length !== expectedLength) {
      return {
        ok: false,
        status: 400,
        message: `Guess must be ${expectedLength} letters`,
      };
    }

    const language = game.gameSettings.language || "en";
    const validation = await WordManager.validateGuess(
      guessedWord,
      expectedLength,
      language
    );

    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        message: validation.error || "Not a valid word",
      };
    }

    const targetWord = game.currentWord.word;
    const feedback = this.compareWords(guessedWord, targetWord);

    game.currentWord.attempts = (game.currentWord.attempts || 0) + 1;
    const currentAttempts = game.currentWord.attempts;
    player.attempts = (player.attempts || 0) + 1;

    const isCorrect = guessedWord === targetWord;
    const maxTries = game.gameSettings.maxTries;
    const isLastAttempt = currentAttempts >= maxTries;

    let roundComplete = false;
    let winner: string | null = null;
    let roundEndReason: RoundEndReason | null = null;

    if (isCorrect) {
      roundComplete = true;
      winner = userId;
      roundEndReason = "correct_guess";

      const guessTime = this.calculateGuessTime(game.startedAt);
      const score = this.calculateScore(
        currentAttempts,
        guessTime,
        game.gameSettings
      );

      player.score += score;
      player.wordsGuessed += 1;

      game.currentWord.guessedBy = userId;
      game.currentWord.guessTime = guessTime;

      logger.info(
        `Player ${userId} guessed correctly! Score: ${score}, Total: ${player.score}`
      );
    } else if (isLastAttempt) {
      roundComplete = true;
      roundEndReason = "max_tries";

      logger.info(`Round ended: Max tries reached for game ${gameId}`);
    }

    await game.save();

    const guessResult: GuessResultPayload = {
      guess: guessedWord,
      feedback,
      isCorrect,
      attempts: currentAttempts,
      maxTries,
      userId,
      username: player.user.username,
    };

    const gameRoomKey = game.gameId;
    emitGuessResult(gameRoomKey, guessResult);

    if (roundComplete) {
      const roundResult = await this.handleRoundEnd(
        game,
        winner,
        roundEndReason
      );

      emitRoundComplete(gameRoomKey, roundResult);

      if (roundResult.gameComplete) {
        emitGameOver(gameRoomKey, {
          gameId: game.gameId,
          winner: roundResult.winner,
          finalScores: roundResult.finalScores || [],
          reason: roundResult.reason,
        });
      }

      return { ok: true, guessResult, roundComplete: true, roundResult };
    }

    const nextPlayer = this.getNextPlayer(game, userId);
    game.currentTurn = nextPlayer.user._id;
    await game.save();

    const nextTurnId = nextPlayer.user._id.toString();
    emitTurnChange(gameRoomKey, {
      currentTurn: nextTurnId,
      username: nextPlayer.user.username,
    });

    logger.info(`Turn changed to: ${nextPlayer.user.username}`);

    return {
      ok: true,
      guessResult,
      roundComplete: false,
      nextTurn: nextTurnId,
    };
  }

  async submitGuess(req: Request, res: Response) {
    try {
      const gameId = req.params.gameId as string;
      const { guess } = req.body;
      const userId = (req as any).user.userId;

      const result = await this.processGuess(gameId, userId, guess);

      if (!result.ok) {
        return res
          .status(result.status)
          .json({ success: false, message: result.message });
      }

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error("Submit guess error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit guess",
      });
    }
  }

  compareWords(guess: string, target: string): LetterFeedback[] {
    const feedback: LetterFeedback[] = [];
    const targetLetters = target.split("");
    const guessLetters = guess.split("");

    const targetUsed = new Array(target.length).fill(false);

    for (let i = 0; i < guessLetters.length; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        feedback[i] = {
          letter: guessLetters[i],
          status: "correct",
        };
        targetUsed[i] = true;
      }
    }

    for (let i = 0; i < guessLetters.length; i++) {
      if (feedback[i]) continue;

      const letter = guessLetters[i];
      let foundAt = -1;

      for (let j = 0; j < targetLetters.length; j++) {
        if (!targetUsed[j] && targetLetters[j] === letter) {
          foundAt = j;
          break;
        }
      }

      if (foundAt !== -1) {
        feedback[i] = {
          letter,
          status: "present",
        };
        targetUsed[foundAt] = true;
      } else {
        feedback[i] = {
          letter,
          status: "absent",
        };
      }
    }

    return feedback;
  }

  calculateScore(attempts: number, guessTime: number, settings: any): number {
    const baseScore = 100;
    const maxTries = settings.maxTries || 6;

    // Penalty for attempts (fewer attempts = higher score)
    const attemptBonus = ((maxTries - attempts + 1) / maxTries) * 50;

    // Time bonus (faster = higher score, max 50 points)
    const timeLimit = settings.timePerRound || 60;
    const timeBonus = Math.max(0, ((timeLimit - guessTime) / timeLimit) * 50);

    // Difficulty multiplier
    const difficultyMultipliers: Record<string, number> = {
      easy: 1.0,
      medium: 1.5,
      hard: 2.0,
    };
    const multiplier = difficultyMultipliers[settings.difficulty] || 1.5;

    const totalScore = Math.round(
      (baseScore + attemptBonus + timeBonus) * multiplier
    );

    return Math.max(0, totalScore);
  }

  calculateGuessTime(startTime: Date | string | null): number {
    if (!startTime) return 0;
    const elapsed = Date.now() - new Date(startTime).getTime();
    return Math.floor(elapsed / 1000);
  }

  getNextPlayer(game: any, currentUserId: string): any {
    const currentIndex = game.players.findIndex(
      (p: any) => p.user._id.toString() === currentUserId
    );

    const nextIndex = (currentIndex + 1) % game.players.length;
    return game.players[nextIndex];
  }

  async handleRoundEnd(
    game: any,
    winnerId: string | null,
    reason: RoundEndReason | null
  ): Promise<RoundCompletePayload> {
    try {
      // Save round to history
      const roundData = {
        roundNumber: game.currentRound,
        word: game.currentWord.word,
        hint: game.currentWord.hint,
        winner: winnerId || null,
        guessTime: game.currentWord.guessTime || 0,
        attempts: game.currentWord.attempts || 0,
        completedAt: new Date(),
      };

      game.rounds.push(roundData);

      // Get winner info
      let winnerInfo = null;
      if (winnerId) {
        const winnerPlayer = game.players.find(
          (p: any) => p.user._id.toString() === winnerId
        );
        if (winnerPlayer) {
          winnerInfo = {
            userId: winnerId,
            username: winnerPlayer.user.username,
            avatar: winnerPlayer.user.avatar,
            score: winnerPlayer.score,
          };
        }
      }

      // Check if game should end
      const roundsToWin = game.gameSettings.roundsToWin || 3;
      const shouldEndGame = game.currentRound >= roundsToWin;

      if (shouldEndGame) {
        // Game over - determine overall winner
        await this.endGame(game);

        return {
          roundNumber: game.currentRound,
          word: game.currentWord.word,
          winner: winnerInfo,
          reason,
          gameComplete: true,
          finalScores: game.players.map((p: any) => ({
            userId: p.user._id.toString(),
            username: p.user.username,
            avatar: p.user.avatar,
            score: p.score,
            wordsGuessed: p.wordsGuessed,
          })),
          overallWinner: game.winner ? game.winner.toString() : null,
        };
      }

      // Start next round
      game.currentRound += 1;

      // Select new word for next round
      const newWord = await WordManager.selectWord(
        game.gameSettings.language,
        game.gameSettings.wordLength,
        game.gameSettings.difficulty
      );

      if (!newWord) {
        throw new Error("Failed to select word for next round");
      }

      // Reset current word data
      game.currentWord = {
        wordId: newWord._id,
        word: newWord.word.toUpperCase(),
        language: game.gameSettings.language,
        hint: newWord.hint,
        category: newWord.category,
        difficulty: game.gameSettings.difficulty,
        attempts: 0,
      };

      // Reset turn to first player
      game.currentTurn = game.players[0].user._id;
      game.startedAt = new Date();

      await game.save();

      logger.info(
        `Round ${game.currentRound - 1} ended. Starting round ${
          game.currentRound
        }`
      );

      return {
        roundNumber: game.currentRound - 1,
        word: roundData.word,
        winner: winnerInfo,
        reason,
        gameComplete: false,
        nextRound: {
          roundNumber: game.currentRound,
          wordLength: newWord.length,
          currentTurn: game.currentTurn.toString(),
          startTime: game.startedAt,
        },
      };
    } catch (error) {
      logger.error("Handle round end error:", error);
      throw error;
    }
  }

  async endGame(game: any): Promise<void> {
    try {
      // Determine overall winner (highest score)
      let highestScore = -1;
      let winnerId: any = null;

      game.players.forEach((player: any) => {
        if (player.score > highestScore) {
          highestScore = player.score;
          winnerId = player.user._id;
        }
      });

      game.winner = winnerId;
      game.status = "completed";
      game.completedAt = new Date();

      // Save final scores
      game.finalScores = game.players.map((p: any) => ({
        user: p.user._id,
        score: p.score,
        wordsGuessed: p.wordsGuessed,
        averageTime: p.averageGuessTime || 0,
      }));

      await game.save();

      // Update user stats
      await this.updatePlayerStats(game);

      // Update room status
      await Room.findOneAndUpdate(
        { currentGame: game._id },
        { status: "waiting", currentGame: null }
      );

      // Update word statistics
      if (game.currentWord.wordId) {
        const wasGuessed = game.currentWord.guessedBy != null;
        const guessTime = game.currentWord.guessTime || 0;
        await WordManager.updateWordStats(
          game.currentWord.wordId,
          wasGuessed,
          guessTime
        );
      }

      logger.info(`Game ${game.gameId} completed. Winner: ${winnerId}`);
    } catch (error) {
      logger.error("End game error:", error);
      throw error;
    }
  }

  async updatePlayerStats(game: any): Promise<void> {
    try {
      for (const player of game.players) {
        const isWinner = player.user._id.toString() === game.winner?.toString();
        const isDraw = !game.winner;

        const updates: any = {
          $inc: {
            "stats.totalGames": 1,
            "stats.gamesWon": isWinner ? 1 : 0,
            "stats.gamesLost": !isWinner && !isDraw ? 1 : 0,
            "stats.gamesDraw": isDraw ? 1 : 0,
            "stats.totalWordsGuessed": player.wordsGuessed || 0,
          },
          status: "online",
          currentRoomId: null,
        };

        // Update win streak
        if (isWinner) {
          await User.findByIdAndUpdate(player.user._id, {
            ...updates,
            $inc: {
              ...updates.$inc,
              "stats.winStreak": 1,
            },
          });

          // Check and update best streak
          const user: any = await User.findById(player.user._id);
          if (user && user.stats.winStreak > user.stats.bestStreak) {
            user.stats.bestStreak = user.stats.winStreak;
            await user.save();
          }
        } else {
          // Reset win streak on loss
          await User.findByIdAndUpdate(player.user._id, {
            ...updates,
            "stats.winStreak": 0,
          });
        }
      }

      logger.info(`Updated stats for ${game.players.length} players`);
    } catch (error) {
      logger.error("Update player stats error:", error);
    }
  }

  async getMatchHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Get filter parameters
      const search = (req.query.search as string) || "";
      const resultFilter = (req.query.result as string) || "all";

      console.log(
        `Fetching match history for user: ${userId}, search: "${search}", result: "${resultFilter}"`
      );

      // Build the base query
      let query = {
        "players.user": userId,
        status: "completed",
      };

      // Get all games first (we'll filter after populating for complex filters)
      let games: any[] = await Games.find(query)
        .populate("players.user", "avatar username stats")
        .populate("winner", "avatar username")
        .sort({ completedAt: -1 });

      console.log(`Found ${games.length} total games before filtering`);

      // Filter valid games and transform to match history format
      const allMatches = games
        .filter((game: any) => {
          const hasPlayers =
            game.players &&
            game.players.length >= 2 &&
            game.players.every((player: any) => player.user && player.user._id);
          if (!hasPlayers) {
            console.warn(`Game ${game._id} has missing player data, skipping`);
          }
          return hasPlayers;
        })
        .map((match: any) => {
          const currUser = match.players.find(
            (player: any) => player.user._id.toString() === userId
          );
          const opponent = match.players.find(
            (player: any) => player.user._id.toString() !== userId
          );

          if (!currUser || !opponent) {
            console.warn(
              `Game ${match._id} missing current user or opponent, skipping`
            );
            return null;
          }

          let result = "draw";
          let yourScore = currUser?.score || 0;
          let opponentScore = opponent?.score || 0;

          if (match?.winner) {
            result = match.winner._id.toString() === userId ? "won" : "lost";
          } else if (yourScore > opponentScore) {
            result = "won";
          } else if (yourScore < opponentScore) {
            result = "lost";
          }

          const word =
            match.currentWord?.word ||
            match.targetWord ||
            match.word ||
            "UNKNOWN";

          return {
            id: match._id,
            opponentAvatar: opponent?.user?.avatar || "/images/user-solid.svg",
            opponentDisplay: `Vs ${opponent?.user?.username || "Unknown"}`,
            opponentUsername: opponent?.user?.username || "Unknown",
            result: {
              status: result,
              display: result.charAt(0).toUpperCase() + result.slice(1),
            },
            scoreDisplay: `${yourScore} - ${opponentScore}`,
            yourScore,
            opponentScore,
            date: this.formatDate(match.completedAt),
            completedAt: match.completedAt,
            duration: this.formatDuration(match.completedAt, match.startedAt),
            durationDisplay: this.formatDuration(
              match.completedAt,
              match.startedAt
            ),
            word: word,
            wordDisplay: `Word: ${word.toUpperCase()}`,
            guesses:
              currUser?.attempts ||
              currUser?.guesses?.length ||
              Math.floor(Math.random() * 5 + 1),
            guessesDisplay: `${
              currUser?.attempts ||
              currUser?.guesses?.length ||
              Math.floor(Math.random() * 5 + 1)
            } guesses`,
            opponent: {
              id: opponent?.user?._id,
              username: opponent?.user?.username || "Unknown",
              avatar: opponent?.user?.avatar || "/images/user-solid.svg",
            },
            timeAgo: this.getTimeAgo(match.completedAt),
            gameSettings: match.gameSettings,
          };
        })
        .filter(Boolean) as any[];

      // Apply filters
      let filteredMatches = allMatches;

      // Apply search filter (opponent username or word)
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        filteredMatches = filteredMatches.filter((match: any) => {
          const opponentMatch = match.opponentUsername
            .toLowerCase()
            .includes(searchLower);
          const wordMatch = match.word.toLowerCase().includes(searchLower);
          return opponentMatch || wordMatch;
        });
      }

      // Apply result filter
      if (resultFilter && resultFilter !== "all") {
        filteredMatches = filteredMatches.filter((match: any) => {
          return match.result.status === resultFilter;
        });
      }

      console.log(`${filteredMatches.length} matches after filtering`);

      // Apply pagination to filtered results
      const totalFilteredGames = filteredMatches.length;
      const paginatedMatches = filteredMatches.slice(skip, skip + limit);

      const totalPages = Math.ceil(totalFilteredGames / limit);

      res.json({
        success: true,
        matchHistory: paginatedMatches,
        pagination: {
          currentPage: page,
          totalPages,
          totalGames: totalFilteredGames,
          matchesPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          startIndex: totalFilteredGames > 0 ? skip + 1 : 0,
          endIndex: Math.min(skip + limit, totalFilteredGames),
        },
        count: {
          total: totalFilteredGames,
          showing: paginatedMatches.length,
        },
        filters: {
          search: search,
          result: resultFilter,
        },
      });
    } catch (error: any) {
      console.error("Get match history error details:", error);
      logger.error("Get match history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load match history",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  async getPerformanceData(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const months = parseInt(req.query.months as string) || 6; // Default to 6 months

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get all completed games in the date range
      const games: any[] = await Games.find({
        "players.user": userId,
        status: "completed",
        completedAt: {
          $gte: startDate,
          $lte: endDate,
        },
      }).populate("winner", "username");

      // Group games by month
      const monthlyStats: Record<string, any> = {};

      // Initialize months with zero values
      for (let i = 0; i < months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleString("en-US", { month: "short" });
        monthlyStats[monthKey] = {
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0,
          month: monthKey,
          monthIndex: i,
        };
      }

      // Process each game
      games.forEach((game: any) => {
        const gameDate = new Date(game.completedAt);
        const monthKey = gameDate.toLocaleString("en-US", { month: "short" });

        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].total++;

          // Determine result
          const currentUser = game.players.find(
            (p: any) => p.user.toString() === userId
          );
          const opponent = game.players.find(
            (p: any) => p.user.toString() !== userId
          );

          // Skip if we can't find both players
          if (!currentUser || !opponent) {
            console.warn(
              `Game ${game._id} missing player data in performance calculation`
            );
            return;
          }

          let result = "draw";
          if (game.winner) {
            result = game.winner._id.toString() === userId ? "won" : "lost";
          } else if (currentUser && opponent) {
            const yourScore = currentUser.score || 0;
            const oppScore = opponent.score || 0;

            if (yourScore > oppScore) result = "won";
            else if (yourScore < oppScore) result = "lost";
            else result = "draw";
          }

          // Update stats
          if (result === "won") monthlyStats[monthKey].wins++;
          else if (result === "lost") monthlyStats[monthKey].losses++;
          else monthlyStats[monthKey].draws++;
        }
      });

      // Convert to array and sort by month (most recent first)
      const performanceData = Object.values(monthlyStats)
        .sort((a: any, b: any) => a.monthIndex - b.monthIndex)
        .reverse()
        .map((stat: any) => ({
          month: stat.month,
          wins: stat.wins,
          losses: stat.losses,
          draws: stat.draws,
          total: stat.total,
          winRate:
            stat.total > 0 ? Math.round((stat.wins / stat.total) * 100) : 0,
        }));

      // Calculate overall stats for the period
      const totalGames = games.length;
      const totalWins = performanceData.reduce(
        (sum: number, month: any) => sum + month.wins,
        0
      );
      const totalLosses = performanceData.reduce(
        (sum: number, month: any) => sum + month.losses,
        0
      );
      const totalDraws = performanceData.reduce(
        (sum: number, month: any) => sum + month.draws,
        0
      );

      res.json({
        success: true,
        performanceOverview: {
          period: `Last ${months} months`,
          monthlyData: performanceData,
          summary: {
            totalGames,
            totalWins,
            totalLosses,
            totalDraws,
            overallWinRate:
              totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
          },
        },
      });
    } catch (error) {
      logger.error("Get performance overview error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load performance overview",
      });
    }
  }

  async getUserStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      console.log(`Calculating user stats for user: ${userId}`);

      // Get all completed games for the user
      const games: any[] = await Games.find({
        "players.user": userId,
        status: "completed",
      })
        .populate("players.user", "username")
        .populate("winner", "username")
        .sort({ completedAt: -1 });

      console.log(
        `Found ${games.length} completed games for stats calculation`
      );

      // Initialize stats
      let totalGames = 0;
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let totalGuesses = 0;
      let totalGameDuration = 0;
      let validDurationGames = 0;
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;
      let isStreakActive = true;

      games.forEach((game: any, index: number) => {
        const currUser = game.players.find((player: any) => {
          const pid = player.user?._id ?? player.user;
          return pid && pid.toString() === userId;
        });

        const opponent = game.players.find((player: any) => {
          const pid = player.user?._id ?? player.user;
          return pid && pid.toString() !== userId;
        });

        // Skip if we can't find both players
        if (!currUser || !opponent) {
          console.warn(
            `Game ${game._id} missing player data in stats calculation`
          );
          return;
        }

        totalGames++;

        // Calculate result
        let result = "draw";
        const yourScore = currUser.score || 0;
        const oppScore = opponent.score || 0;

        if (game.winner) {
          result = game.winner._id.toString() === userId ? "won" : "lost";
        } else if (yourScore > oppScore) {
          result = "won";
        } else if (yourScore < oppScore) {
          result = "lost";
        }

        // Update win/loss/draw counts
        if (result === "won") {
          wins++;
          if (isStreakActive) {
            tempStreak++;
            if (index === 0) currentStreak = tempStreak; // Current streak is only for most recent games
          } else {
            tempStreak = 1;
            isStreakActive = true;
            if (index === 0) currentStreak = 1;
          }
        } else {
          if (isStreakActive && index === 0) {
            currentStreak = 0; // Current streak broken
          }
          isStreakActive = false;
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 0;

          if (result === "lost") {
            losses++;
          } else {
            draws++;
          }
        }

        // Update best streak
        bestStreak = Math.max(bestStreak, tempStreak);

        // Calculate guesses (attempts)
        const guesses = currUser.attempts || currUser.wordsGuessed || 0;
        totalGuesses += guesses;

        // Calculate game duration
        if (game.completedAt && game.startedAt) {
          const duration =
            new Date(game.completedAt).getTime() -
            new Date(game.startedAt).getTime();
          if (duration > 0) {
            totalGameDuration += duration;
            validDurationGames++;
          }
        }
      });

      // Calculate derived stats
      const winRate =
        totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      const averageGuesses =
        totalGames > 0 ? Math.round((totalGuesses / totalGames) * 10) / 10 : 0;
      const averageGameDuration =
        validDurationGames > 0
          ? Math.round(totalGameDuration / validDurationGames / 1000) // Convert to seconds
          : 0;

      // Format average game duration
      const formatAverageDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0
          ? `${minutes}m ${remainingSeconds}s`
          : `${minutes}m`;
      };

      const stats = {
        totalGames,
        wins,
        losses,
        draws,
        winRate,
        currentStreak,
        bestStreak,
        averageGuesses,
        averageGameDuration: formatAverageDuration(averageGameDuration),
        averageGameDurationSeconds: averageGameDuration,
        winLossRecord: `${wins}W - ${losses}L - ${draws}D`,
      };

      console.log(`Calculated stats:`, stats);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error("Get user stats error:", error);
      logger.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load user stats",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  calculateStreaks(gameResults: Array<{ result: string }>): {
    currentStreak: number;
    bestStreak: number;
  } {
    if (gameResults.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // Calculate current streak (from most recent games)
    for (let i = 0; i < gameResults.length; i++) {
      if (gameResults[i].result === "won") {
        currentStreak++;
      } else {
        break; // Current streak broken
      }
    }

    // Calculate best streak (scan all games)
    gameResults.forEach((game) => {
      if (game.result === "won") {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    return { currentStreak, bestStreak };
  }

  formatDate(date: Date | string): string {
    const gameDate = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return gameDate.toLocaleDateString("en-US", options);
  }

  formatDuration(
    completedAt: Date | string,
    startedAt: Date | string
  ): string {
    if (!completedAt || !startedAt) return "N/A";

    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (Number.isNaN(durationMs) || durationMs < 0) return "N/A";

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  getTimeAgo(date: Date | string): string {
    if (!date) return "N/A";
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();

    // If date is in future or invalid
    if (Number.isNaN(diffMs)) return "N/A";
    if (diffMs < 0) return "just now"; // if future due to clock skew, show friendly text

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins <= 0) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return `${diffMonths}mo ago`;
  }
}

export default new GameController();

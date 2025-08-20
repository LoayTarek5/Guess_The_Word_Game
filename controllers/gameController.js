import User from "../models/User.js";
import Games from "../models/Games.js";
import logger from "../utils/logger.js";

class GameController {
  async getMatchHistory(req, res) {
    try {
      const userId = req.user.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get filter parameters
      const search = req.query.search || "";
      const resultFilter = req.query.result || "all";

      console.log(
        `Fetching match history for user: ${userId}, search: "${search}", result: "${resultFilter}"`
      );

      // Build the base query
      let query = {
        "players.user": userId,
        status: "completed",
      };

      // Get all games first (we'll filter after populating for complex filters)
      let games = await Games.find(query)
        .populate("players.user", "avatar username stats")
        .populate("winner", "avatar username")
        .sort({ completedAt: -1 });

      console.log(`Found ${games.length} total games before filtering`);

      // Filter valid games and transform to match history format
      const allMatches = games
        .filter((game) => {
          const hasPlayers =
            game.players &&
            game.players.length >= 2 &&
            game.players.every((player) => player.user && player.user._id);
          if (!hasPlayers) {
            console.warn(`Game ${game._id} has missing player data, skipping`);
          }
          return hasPlayers;
        })
        .map((match) => {
          const currUser = match.players.find(
            (player) => player.user._id.toString() === userId
          );
          const opponent = match.players.find(
            (player) => player.user._id.toString() !== userId
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
        .filter(Boolean);

      // Apply filters
      let filteredMatches = allMatches;

      // Apply search filter (opponent username or word)
      if (search && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        filteredMatches = filteredMatches.filter((match) => {
          const opponentMatch = match.opponentUsername
            .toLowerCase()
            .includes(searchLower);
          const wordMatch = match.word.toLowerCase().includes(searchLower);
          return opponentMatch || wordMatch;
        });
      }

      // Apply result filter
      if (resultFilter && resultFilter !== "all") {
        filteredMatches = filteredMatches.filter((match) => {
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
    } catch (error) {
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

  async getPerformanceData(req, res) {
    try {
      const userId = req.user.userId;
      const { months = 6 } = req.query; // Default to 6 months

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get all completed games in the date range
      const games = await Games.find({
        "players.user": userId,
        status: "completed",
        completedAt: {
          $gte: startDate,
          $lte: endDate,
        },
      }).populate("winner", "username");

      // Group games by month
      const monthlyStats = {};

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
      games.forEach((game) => {
        const gameDate = new Date(game.completedAt);
        const monthKey = gameDate.toLocaleString("en-US", { month: "short" });

        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].total++;

          // Determine result
          const currentUser = game.players.find(
            (p) => p.user.toString() === userId
          );
          const opponent = game.players.find(
            (p) => p.user.toString() !== userId
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
        .sort((a, b) => a.monthIndex - b.monthIndex)
        .reverse()
        .map((stat) => ({
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
        (sum, month) => sum + month.wins,
        0
      );
      const totalLosses = performanceData.reduce(
        (sum, month) => sum + month.losses,
        0
      );
      const totalDraws = performanceData.reduce(
        (sum, month) => sum + month.draws,
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

 async getUserStats(req, res) {
    try {
      const userId = req.user.userId;

      console.log(`Calculating user stats for user: ${userId}`);

      // Get all completed games for the user
      const games = await Games.find({
        "players.user": userId,
        status: "completed",
      })
        .populate("players.user", "username")
        .populate("winner", "username")
        .sort({ completedAt: -1 });

      console.log(`Found ${games.length} completed games for stats calculation`);

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

      // Process each game
      games.forEach((game, index) => {
        const currUser = game.players.find(
          (player) => player.user._id.toString() === userId
        );
        const opponent = game.players.find(
          (player) => player.user._id.toString() !== userId
        );

        // Skip if we can't find both players
        if (!currUser || !opponent) {
          console.warn(`Game ${game._id} missing player data in stats calculation`);
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
          const duration = new Date(game.completedAt) - new Date(game.startedAt);
          if (duration > 0) {
            totalGameDuration += duration;
            validDurationGames++;
          }
        }
      });

      // Calculate derived stats
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      const averageGuesses = totalGames > 0 ? Math.round((totalGuesses / totalGames) * 10) / 10 : 0;
      const averageGameDuration = validDurationGames > 0 
        ? Math.round((totalGameDuration / validDurationGames) / 1000) // Convert to seconds
        : 0;

      // Format average game duration
      const formatAverageDuration = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
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
    } catch (error) {
      console.error("Get user stats error:", error);
      logger.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load user stats",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  calculateStreaks(gameResults) {
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

  formatDate(date) {
    const gameDate = new Date(date);
    const options = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return gameDate.toLocaleDateString("en-US", options);
  }

  formatDuration(completedAt, startedAt) {
    if (!completedAt || !startedAt) return "N/A";

    const durationMs = new Date(completedAt) - new Date(startedAt);
    if (Number.isNaN(durationMs) || durationMs < 0) return "N/A";

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  getTimeAgo(date) {
    if (!date) return "N/A";
    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;

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

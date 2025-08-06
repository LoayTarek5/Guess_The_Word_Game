import User from "../models/User.js";
import Games from "../models/Games.js";
import logger from "../utils/logger.js";

class GameController {
  async getMatchHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 10, page = 1 } = req.query;
      const skip = (page - 1) * limit;

      const games = await Games.find({
        "players.user": userId,
        status: "completed",
      })
        .populate("players.user", "avatar username stats")
        .populate("winner", "avatar username")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const matchHistory = games.map((match) => {
        const currUser = match.players.find(
          (player) => player.user._id.toString() === userId
        );
        const opponent = match.players.find(
          (player) => player.user._id.toString() !== userId
        );

        let result = "Draw";
        let yourScore = currUser?.score || 0;
        let opponentScore = opponent?.score || 0;

        if (match?.winner) {
          result = match.winner._id.toString() === userId ? "Won" : "Lost";
        } else if (yourScore > opponentScore) {
          result = "Won";
        } else if (yourScore < opponentScore) {
          result = "Lost";
        }

        return {
          id: match._id,
          opponentAvatar: opponent?.user.avatar,
          opponentDisplay: `Vs ${opponent?.user.username || "Unknown"}`,
          result: {
            status: result.toLowerCase(), 
            display: result, 
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
          word: match.targetWord || match.word || "UNKNOWN", 
          wordDisplay: `Word: ${(
            match.targetWord ||
            match.word ||
            "UNKNOWN"
          ).toUpperCase()}`,
          guesses: currUser?.guesses?.length || 0,
          guessesDisplay: `${currUser?.guesses?.length || 0} guesses`,
          opponent: {
            id: opponent?.user._id,
            username: opponent?.user.username || "Unknown",
            avatar: opponent?.user.avatar,
          },
          timeAgo: this.getTimeAgo(match.completedAt),
          gameSettings: match.gameSettings,
        };
      });

      // Get total count for pagination
      const totalGames = await Games.countDocuments({
        "players.user": userId,
        status: "completed",
      });

      res.json({
        success: true,
        matchHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalGames / limit),
          totalGames,
          hasNext: skip + games.length < totalGames,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error("Get match history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load match history",
      });
    }
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
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return `${diffMonths}mo ago`;
  }
}

export default new GameController();

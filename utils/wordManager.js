import WordBank from "../models/WordBank";

class WordManager {
  async selectWord(language = "en", wordLength = 5, difficulty = "medium") {
    try {
      logger.info(
        `Selecting word: language=${language}, length=${wordLength}, difficulty=${difficulty}`
      );

      const query = {
        lang: language,
        len: wordLength,
      };

      const difficultyMap = {
        easy: "easy",
        beginner: "easy",
        normal: "medium",
        classic: "medium",
        medium: "medium",
        hard: "hard",
        expert: "hard",
        custom: "medium", // Default for custom
      };

      const mappedDifficulty =
        difficultyMap[difficulty.toLowerCase()] || "medium";
      query.difficulty = mappedDifficulty;

      const count = await WordBank.countDocuments(query);
      logger.info(`Found ${count} words matching criteria`);

      if (count === 0) {
        logger.warn(
          `No words found for: ${language}, length: ${wordLength}, difficulty: ${mappedDifficulty}`
        );

        // Fallback: Try without difficulty filter
        delete query.difficulty;
        const fallbackCount = await WordBank.countDocuments(query);
        logger.info(`Fallback count without difficulty: ${fallbackCount}`);

        if (fallbackCount === 0) {
          logger.error(
            `No words found for language: ${language}, length: ${wordLength}`
          );
          return null;
        }

        // Select random word without difficulty filter
        const results = await WordBank.aggregate([
          { $match: query },
          { $sample: { size: 1 } },
        ]);
        const selectedWord = results[0] || null;

        logger.info(`Selected fallback word: ${selectedWord.word}`);

        // Increment usage count asynchronously (don't wait)
        selectedWord.incrementUsage().catch((err) => {
          logger.error("Failed to increment word usage:", err);
        });

        return selectedWord;
      }

      const results = await WordBank.aggregate([
        { $match: query },
        { $sample: { size: 1 } },
      ]);
      const selectedWord = results[0] || null;

      if (!selectedWord) {
        logger.error("Failed to select word despite count > 0");
        return null;
      }

      // Increment usage count asynchronously (don't wait)
      selectedWord.incrementUsage().catch((err) => {
        logger.error("Failed to increment word usage:", err);
      });

      logger.info(
        `✓ Selected word: ${selectedWord.word} (${language}, ${wordLength} letters, ${mappedDifficulty})`
      );

      return selectedWord;
    } catch (error) {
      logger.error("Error selecting word:", error);
      throw error;
    }
  }

  async validateWord(word, language = "en") {
    try {
      const exists = await WordBank.exists({
        word: word.toUpperCase(),
        language: language,
      });

      return !!exists;
    } catch (error) {
      logger.error("Error validating word:", error);
      return false;
    }
  }

  async validateGuess(word, expectedLength, language = "en") {
    try {
      // Check length first
      if (word.length !== expectedLength) {
        return {
          valid: false,
          error: `Word must be ${expectedLength} letters`,
        };
      }

      // Check if word exists in dictionary
      const exists = await this.validateWord(word, language);

      if (!exists) {
        return {
          valid: false,
          error: "Not in word list",
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      logger.error("Error validating guess:", error);
      return {
        valid: false,
        error: "Validation failed",
      };
    }
  }

  async updateWordStats(wordId, wasGuessed, guessTime) {
    try {
      const word = await WordBank.findById(wordId);
      if (!word) {
        logger.warn(`Word not found for stats update: ${wordId}`);
        return;
      }

      // Update success rate
      await word.updateSuccessRate(wasGuessed);

      // Update average guess time if word was guessed
      if (wasGuessed && guessTime > 0) {
        const totalGuesses = Math.round(
          (word.successRate / 100) * word.usageCount
        );
        if (totalGuesses > 0) {
          const currentTotal = word.averageGuessTime * (totalGuesses - 1);
          word.averageGuessTime = (currentTotal + guessTime) / totalGuesses;
          await word.save();
        }
      }

      logger.info(
        `Updated stats for word: ${
          word.word
        }, Success rate: ${word.successRate.toFixed(1)}%`
      );
    } catch (error) {
      logger.error("Error updating word stats:", error);
    }
  }
}

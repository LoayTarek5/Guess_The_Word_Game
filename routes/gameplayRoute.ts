import express from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import gameController from "../controllers/gameController.js";
import roomController from "../controllers/roomController.js";

const router = express.Router();

router.get("/", requireAuth, (req: Request, res: Response) => {
  res.render("gameplay", {
    pageTitle: "Game Play",
    page: "gameplay",
    layout: false,
  });
});

// Start a game for a room (host only) — handled by the room controller.
router.post(
  "/start/:roomId",
  requireAuth,
  (roomController as any).startGame.bind(roomController)
);

// Get current game state
router.get(
  "/state/:gameId",
  requireAuth,
  gameController.getGameState.bind(gameController)
);

// Submit a guess
router.post(
  "/guess/:gameId",
  requireAuth,
  gameController.submitGuess.bind(gameController)
);

export default router;

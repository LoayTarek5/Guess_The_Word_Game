import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import gameController from "../controllers/gameController.js";

const router = express.Router();

// router.get("/:gameId", requireAuth, (req, res) => {
//   res.render("gameplay", {
//     gameId: req.params.gameId,
//     user: req.user,
//     pageTitle: "Game Play",
//     page: "gameplay",
//   });
// });

router.get("/", requireAuth, (req, res) => {
  res.render("gameplay", {
    // gameId: req.params.gameId,
    // user: req.user,
    pageTitle: "Game Play",
    page: "gameplay",
    layout: false,
  });
});

router.post("/start/:roomId", requireAuth, gameController.startGame);

// Get current game state
router.get("/state/:gameId", requireAuth, gameController.getGameState);

// Submit a guess
router.post("/guess/:gameId", requireAuth, gameController.submitGuess);

export default router;

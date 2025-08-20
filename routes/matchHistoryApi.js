import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import gameController from "../controllers/gameController.js";

const router = express.Router();
// Get match history
router.get("/history", requireAuth, gameController.getMatchHistory.bind(gameController));

// Get User stats
router.get('/stats', requireAuth, gameController.getUserStats.bind(gameController));

// Get performance data
router.get("/performance", requireAuth, gameController.getPerformanceData.bind(gameController));

export default router;
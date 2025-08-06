import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import gameController from "../controllers/gameController.js";

const router = express.Router();
// Get match history
router.get("/history", requireAuth, gameController.getMatchHistory);

// Get performance data
router.get("/performance", requireAuth, gameController.getPerformanceData);

export default router;

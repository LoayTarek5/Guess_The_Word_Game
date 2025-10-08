import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    // Check if user has a currentRoomId
    const user = await User.findById(userId).select("currentRoomId").lean();
    
    if (user?.currentRoomId) {
      return res.redirect(`/room/${user.currentRoomId}`);
    }

    res.render("gameLobby", {
      pageTitle: "Game Lobby",
      page: "lobby",
    });
  } catch (error) {
    console.error("Game lobby error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load game lobby",
    });
  }
});

export default router;

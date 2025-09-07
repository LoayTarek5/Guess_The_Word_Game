import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";

const router = express.Router();

router.get("/:roomId", requireAuth, (req, res) => {
  res.render("room", {
    roomId: req.params.roomId,
    user: req.user,
    pageTitle: "Room Lobby",
    page: "room",
  });
});

export default router;

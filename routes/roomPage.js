import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.render("room", {
    pageTitle: "Room Lobby",
    page: "room",
  });
});

export default router;
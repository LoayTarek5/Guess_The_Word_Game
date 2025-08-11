import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.render("matchHistory", {
    pageTitle: "Match History",
    page: "Match History",
  });
});

export default router;
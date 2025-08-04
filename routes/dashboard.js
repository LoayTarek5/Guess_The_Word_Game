import express from "express";
import { requireAuth } from '../middleware/routeGuards.js';

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.render("dashboard", {
    page: "dashboard"
  });
});

export default router;

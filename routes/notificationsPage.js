import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.render("notifications", {
    pageTitle: "Notifications",
    page: "notifications",
  });
});

export default router;
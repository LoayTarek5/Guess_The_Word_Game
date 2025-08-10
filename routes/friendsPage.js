import express from "express";
import { requireAuth } from "../middleware/routeGuards.js";
import friendController from "../controllers/friendController.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.render("friends", {
    page: "friends"
  });
});

export default router;

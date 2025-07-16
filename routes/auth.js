import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
const router = express.Router();


// Show login page
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login", error: null });
});

// Show signup page
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up", error: null });
});

router.post("/signup", authController.signup.bind(authController));
router.post("/login", authController.login.bind(authController));

router.post("/logout", authenticateToken, authController.logout.bind(authController));

export default router;

import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { validateSignup, validateLogin } from "../middleware/validation.js";
import { redirectIfAuthenticated } from "../middleware/routeGuards.js";

const router = express.Router();


// Show login page
router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("auth/login", { title: "Login", error: null });
});

// Show signup page
router.get("/signup", redirectIfAuthenticated, (req, res) => {
  res.render("auth/signup", { title: "Sign Up", error: null });
});

router.post("/signup", validateSignup, authController.signup.bind(authController));
router.post("/login", validateLogin, authController.login.bind(authController));
router.get("/me", authenticateToken, authController.getProfile.bind(authController));
router.post("/logout", authenticateToken, authController.logout.bind(authController));

export default router;

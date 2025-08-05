import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { validateSignup, validateLogin } from "../middleware/validation.js";
import { redirectIfAuthenticated } from "../middleware/routeGuards.js";

const router = express.Router();

router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("auth/login", {
    layout: "layouts/auth",
    pageTitle: "Login",
  });
});

router.get("/signup", redirectIfAuthenticated, (req, res) => {
  res.render("auth/signup", {
    layout: "layouts/auth",
    pageTitle: "Create Account",
  });
});

router.post(
  "/signup",
  validateSignup,
  authController.signup.bind(authController)
);
router.post("/login", validateLogin, authController.login.bind(authController));
router.get(
  "/me",
  authenticateToken,
  authController.getProfile.bind(authController)
);
router.post("/offline", authController.setOffline.bind(authController));
router.post(
  "/heartbeat",
  authenticateToken,
  authController.heartbeat.bind(authController)
);
router.post(
  "/logout",
  authenticateToken,
  authController.logout.bind(authController)
);

export default router;

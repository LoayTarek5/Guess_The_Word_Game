import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const router = express.Router();

// Show login page
router.get("/login", (req, res) => {
  res.render("auth/login", { title: "Login", error: null });
});

// Show signup page
router.get("/signup", (req, res) => {
  res.render("auth/signup", { title: "Sign Up", error: null });
});

router.get("/signup", (req, res) => {
  const { email, password } = req.body;
});

export default router;

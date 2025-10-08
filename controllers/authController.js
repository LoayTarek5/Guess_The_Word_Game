import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";
class AuthController {
  generateToken(userId) {
    return jwt.sign(
      {
        userId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      }
    );
  }
  // Format user response
  formatUserResponse(user) {
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      currentRoomId: user.currentRoomId,
      status: user.status,
      stats: user.stats,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async signup(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;
      // check if any fields are empty
      if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }

      const usernameExists = await User.exists({ username });
      const emailExists = await User.exists({ email });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: "Username is already taken",
        });
      }
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken",
        });
      }
      const newUser = new User({ username, email, password });
      // Update last seen
      newUser.lastSeen = new Date();
      newUser.status = "online";
      await newUser.save();

      const token = this.generateToken(newUser._id);
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`New user registered: ${username}`);

      res.status(201).json({
        success: true,
        message: "User created successfully",
        user: this.formatUserResponse(newUser),
      });
    } catch (error) {
      logger.error("Signup error:", error);

      // Handle duplicate key error Due To Race Conditions
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } is already taken`,
        });
      }
      res.status(500).json({
        success: false,
        message: "Something went wrong, please try again.",
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const validPassword = await user.comparePassword(password);
      if (!validPassword) {
        return res.status(400).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      // Update last seen
      user.lastSeen = new Date();
      user.status = "online";
      await user.save();

      const token = this.generateToken(user._id);
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      logger.info(`User logged in: ${user.username}`);
      res.json({
        success: true,
        message: "Login successful",
        user: this.formatUserResponse(user),
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong, please try again.",
      });
    }
  }

  async logout(req, res) {
    try {
      const user = await User.findById(req.user.userId);

      if (user) {
        // Invalidate ALL tokens by updating the timestamp
        await user.invalidateAllTokens();

        // Update user status
        user.status = "offline";
        user.lastSeen = new Date();
        await user.save();

        logger.info(
          `Global logout for user: ${user.username} - all sessions invalidated`
        );
      }
      // res.clearCookie("authToken");
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }

  async setOffline(req, res) {
    try {
      const token = req.cookies.authToken;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(decoded.userId, {
          status: "offline",
          lastSeen: new Date(),
        });
        logger.info(`User went offline: ${decoded.userId}`);
      }
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error("Set offline error:", error);
      res.status(200).json({ success: true }); // Always return success to avoid client errors
    }
  }

  async heartbeat(req, res) {
    try {
      const user = await User.findById(req.user.userId);

      if (user) {
        user.lastSeen = new Date();
        if (user.status !== "in match") {
          user.status = "online";
        }
        await user.save();
      }

      res.json({
        success: true,
        message: "Activity updated",
      });
    } catch (error) {
      logger.error("Heartbeat error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update activity",
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user: this.formatUserResponse(user),
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
}

export default new AuthController();

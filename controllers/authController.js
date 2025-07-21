import jwt from "jsonwebtoken";
import User from "../models/User.js";

class AuthController {
  generateToken(userId) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  }
  // Format user response
  formatUserResponse(user) {
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
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
      await newUser.save();

      const token = this.generateToken(newUser._id);
      res.cookie("token", token, { httpOnly: true });
      res.status(201).json({
        success: true,
        message: "User created successfully",
        token,
        user: this.formatUserResponse(newUser),
      });
    } catch (error) {
      console.error("Signup error:", error);

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
      res.json({
        success: true,
        message: "Login successful",
        token,
        user: this.formatUserResponse(user),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong, please try again.",
      });
    }
  }
  
  async logout(req, res) {
    try {
      // Update user status to offline
      await User.findByIdAndUpdate(req.user.userId, {
        status: "offline",
        lastSeen: new Date(),
      });

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
}

export default new AuthController();

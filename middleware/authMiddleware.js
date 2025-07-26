import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // CHECK if token was issued before global logout
    if (user.tokenInvalidatedAt && decoded.iat) {
      const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
      const invalidatedAt = user.tokenInvalidatedAt.getTime();

      if (invalidatedAt > tokenIssuedAt) {
        logger.info(`Token invalidated for user: ${user.username}`);
        return res.status(401).json({
          success: false,
          message: "Session expired due to logout from another device",
        });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

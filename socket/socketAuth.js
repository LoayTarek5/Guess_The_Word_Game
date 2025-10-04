import jwt from "jsonwebtoken";
import User from "../models/User.js";
import cookie from "cookie";

export const authenticateSocket = async (socket, next) => {
  try {
    // Parse cookies from handshake headers
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.authToken;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error("User not found"));
    }

    // Check if token was issued before global logout
    if (user.tokenInvalidatedAt && decoded.iat) {
      const tokenIssuedAt = decoded.iat * 1000;
      const invalidatedAt = user.tokenInvalidatedAt.getTime();

      if (invalidatedAt > tokenIssuedAt) {
        return next(new Error("Token invalidated"));
      }
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
};
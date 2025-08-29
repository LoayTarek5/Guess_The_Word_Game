import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Redirect to dashboard if already logged in (for login/signup pages)
export const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return next(); // No token, proceed to login/signup page
    }

    //  Verify token and check if it's still valid
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists and token is not invalidated
      const user = await User.findById(decoded.userId);
      if (!user) {
        // User doesn't exist, clear cookie and proceed
        res.clearCookie("authToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
        return next();
      }

      //  Check if token was issued before global logout
      if (user.tokenInvalidatedAt && decoded.iat) {
        const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
        const invalidatedAt = user.tokenInvalidatedAt.getTime();

        if (invalidatedAt > tokenIssuedAt) {
          // Token is invalidated, clear cookie and proceed to login/signup
          res.clearCookie("authToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });
          return next();
        }
      }

      // Token is valid, redirect to dashboard
      return res.redirect("/dashboard");
    } catch (jwtError) {
      // Invalid token, clear cookie and proceed
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return next();
    }
  } catch (error) {
    console.error("redirectIfAuthenticated error:", error);
    next();
  }
};

// Require authentication (for protected pages like dashboard)
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return res.redirect("/auth/login");
    }

    //  Verify token and check if it's still valid
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists and token is not invalidated
      const user = await User.findById(decoded.userId);
      if (!user) {
        // User doesn't exist, clear cookie and redirect
        res.clearCookie("authToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
        return res.redirect("/auth/login");
      }

      //  Check if token was issued before global logout
      if (user.tokenInvalidatedAt && decoded.iat) {
        const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
        const invalidatedAt = user.tokenInvalidatedAt.getTime();

        if (invalidatedAt > tokenIssuedAt) {
          // Token is invalidated, clear cookie and redirect
          res.clearCookie("authToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });
          return res.redirect("/auth/login");
        }
      }

      // Token is valid, proceed
      // req.user = decoded;
      req.user = {
        userId: decoded.userId,
        username: user.username,
      };
      return next();
    } catch (jwtError) {
      // Invalid token, clear cookie and redirect
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return res.redirect("/auth/login");
    }
  } catch (error) {
    console.error("requireAuth error:", error);
    return res.redirect("/auth/login");
  }
};

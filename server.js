import "dotenv/config";
import express from "express";
import expressLayouts from "express-ejs-layouts";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import friendRoutes from "./routes/friends.js";
import gameRoutes from "./routes/games.js";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import logger from "./utils/logger.js";
import User from "./models/User.js";
const PORT = process.env.PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/layout");

// Helmet to Secure content Policy 
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        styleSrcElem: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
        ],
        // images
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", process.env.CLIENT_URL],
      },
    },
  })
);

// CORS - environment based
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Compression
app.use(compression());

// Rate limiting - more lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 10000, // Higher limit in dev
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 10000, // Higher limit in dev
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
});

app.use(limiter);
app.use("/auth", authLimiter);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(join(__dirname, "public")));

// Routes
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/games", gameRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// setup Mongo database
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    setInterval(async () => {
      try {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const result = await User.updateMany(
          {
            status: "online",
            lastSeen: { $lt: oneMinuteAgo },
          },
          { status: "offline" }
        );
        if (result.modifiedCount > 0) {
          console.log(`Marked ${result.modifiedCount} users as offline`);
        }
      } catch (error) {
        console.log("Cleanup error:", error);
      }
    }, 1000);
  })
  .catch((err) => console.error("❌ MongoDB error:", err));

app.listen(PORT, () => {
  console.log("Server is Running on port: " + PORT);
});

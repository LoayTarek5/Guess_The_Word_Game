import "dotenv/config"; 
import express from "express";
// import expressLayouts from "express-ejs-layouts";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import path from "path";

const PORT = process.env.PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// app.set("layout", "layouts/layout");

app.use(express.json());
// app.use(expressLayouts);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(join(__dirname, "public")));

// Routes
app.use('/auth', authRoutes);


// setup Mongo database
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));
  

  app.listen(PORT, () => {
  console.log("Server is Running on port: " + PORT);
});
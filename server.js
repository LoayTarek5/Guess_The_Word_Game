import express from "express";
import expressLayouts from "express-ejs-layouts";
import indexRouter from "./routes/index.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";

const PORT = process.env.PORT;
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const {
  MONGO_INITDB_ROOT_USERNAME: MONGO_USER,
  MONGO_INITDB_ROOT_PASSWORD: MONGO_PASS,
  MONGO_HOST,
  MONGO_PORT,
  MONGO_DB
} = process.env;
const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));
app.set("layout", "layouts/layout");

app.use(expressLayouts);
app.use(express.static(join(__dirname, "public")));
app.use("/", indexRouter);

mongoose
  .connect(uri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));
  
app.listen(PORT, () => {
  console.log("Server is Running on port: " + PORT);
});

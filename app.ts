import express from "express";
import { router as index } from "./controller/index";
import cors from "cors";
export const app = express();

// ✅ CORS
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "srv-d2ujn6re5dus73eqnjag",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/", index);
app.use("/", (req, res) => {
  res.send("Hello World!!!");
});

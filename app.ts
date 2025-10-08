import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as customerRouter } from "./controller/customer";
export const app = express();

// ✅ CORS
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://guidefinder-api.onrender.com",
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

app.use(express.json());

app.use("/", index);
app.use("/customer", customerRouter);
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });

app.get("/test-cloudinary", (req, res) => {
  res.json({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
    api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
  });
});

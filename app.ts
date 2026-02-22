import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as customerRouter } from "./controller/customer";
import { router as guideRouter } from "./controller/guide";
import { router as loginRouter } from "./controller/login";
import { router as packageRouter } from "./controller/package";
import { router as locationRouter } from "./controller/location";
import { router as bookingRouter } from "./controller/booking";
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
  }),
);

app.use(express.json());
app.use("/", index);
app.use("/customer", customerRouter);
app.use("/guide", guideRouter);
app.use("/auth", loginRouter);
app.use("/package", packageRouter);
app.use("/location", locationRouter);
app.use("/booking", bookingRouter);
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });

export default app;

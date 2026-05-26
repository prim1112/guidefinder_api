import express from "express";
import cors from "cors";

import { createServer } from "http";
import { Server } from "socket.io";

import { router as index } from "./controller/index";
import { router as customerRouter } from "./controller/customer";
import { router as guideRouter } from "./controller/guide";
import { router as loginRouter } from "./controller/login";
import { router as packageRouter } from "./controller/package";
import { router as locationRouter } from "./controller/location";
import { router as bookingRouter } from "./controller/booking";
import { router as adminRouter } from "./controller/admin";

export const app = express();

export const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 SOCKET CONNECT:", socket.id);

  socket.on("join_room", (roomId) => {
    socket.join(roomId.toString());

    console.log("✅ JOIN ROOM:", roomId);
  });

  socket.on("disconnect", () => {
    console.log("❌ SOCKET DISCONNECT:", socket.id);
  });
});

app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use((req, res, next) => {
  (req as any).userRole = req.headers["x-user-role"];
  (req as any).userId = req.headers["x-user-id"];
  next();
});

app.use("/", index);
app.use("/admin", adminRouter);
app.use("/customer", customerRouter);
app.use("/customer", index);
app.use("/guide", guideRouter);
app.use("/auth", loginRouter);
app.use("/package", packageRouter);
app.use("/location", locationRouter);
app.use("/booking", bookingRouter);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});
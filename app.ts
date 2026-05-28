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

// 💡 1. สร้าง httpServer มารองรับตัวแปร app ดั้งเดิม
export const httpServer = createServer(app); 

// 💡 2. ประกาศเปิดท่อ Socket.io ผูกเข้ากับ httpServer ตั้งค่า CORS และท่อส่งให้ครบถ้วน
export const io = new Server(httpServer, {
  cors: {
    origin: "*", // อนุญาตให้แอป Flutter ทุกเครื่องเชื่อมโยงสัญญาณเข้ามาได้
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ['polling', 'websocket'] // สอดรับกับฝั่ง Flutter บนคลาวด์ Render.com
});

// 💡 3. เอาตัวแปร io ไปฝังไว้ในตัวแปร app เพื่อส่งต่อให้พวกไฟล์สคริปต์เราเตอร์เรียกใช้ได้
app.set("io", io);

// 💡 4. เปิดระเบียงสแตนบายรอเวลาแอป Flutter ทำการเชื่อมต่อท่อเข้ามา
io.on("connection", (socket) => {
  console.log("มีผู้ใช้งานเชื่อมต่อ Socket เข้ามาแล้ว ID: " + socket.id);
  
  // รอฟังเมื่อลูกค้าส่ง ID ตัวเองมา เพื่อจับยัดเข้าห้องรับแจ้งเตือนส่วนตัว
  socket.on("join_room", (roomId) => {
    socket.join(roomId.toString());
    console.log(`User เข้าห้องแจ้งเตือนสำเร็จ ID: ${roomId}`);
  });
});

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

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use("/", index);
app.use("/admin", adminRouter);
app.use("/customer", customerRouter);
app.use("/customer", index);
app.use("/guide", guideRouter);
app.use("/auth", loginRouter);
app.use("/package", packageRouter);
app.use("/location", locationRouter);
app.use("/booking", bookingRouter);
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });


export default app;

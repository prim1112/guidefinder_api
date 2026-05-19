import dotenv from "dotenv";
dotenv.config();

// 💡 เปลี่ยนจากดึง app มาเฉยๆ เป็นดึง httpServer ที่เราเชื่อมท่อ Socket ไว้แล้วมาใช้แทนครับ
import { httpServer } from "./app"; 

const port = process.env.PORT || 3000;

// ❌ ลบตัวแปร const server = http.createServer(app); อันเก่าออกไปได้เลย เพราะเราสร้างไว้ใน app.ts แล้ว

// ✅ สั่งรันออนไลน์ผ่าน httpServer ท่อรวมพลังของเราได้เลย
httpServer.listen(port, () => {
  console.log(`🚀 Server with Socket.io running on port ${port}`);
});
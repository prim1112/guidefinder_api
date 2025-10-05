import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";

// โหลดไฟล์ .env จาก root ของโปรเจกต์ (อยู่ระดับเดียวกับ package.json)
dotenv.config({
  path: path.resolve(__dirname, "../../.env"), // ✅ บอก path ชัด ๆ
});

// ตั้งค่า Cloudinary ด้วยค่าจาก .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string, // ✅ แปลงเป็น string
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

// log ดูค่าที่โหลดได้ (ไว้ตรวจเฉพาะตอน debug)
console.log("🧩 Cloudinary Config Loaded:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
});

export default cloudinary;

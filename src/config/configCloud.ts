// import { v2 as cloudinary } from "cloudinary";

// cloudinary.config({
//   cloud_name: "dzh4fprev",
//   api_key: "682727128739815",
//   api_secret: "8wLeqgpZ756NRnls5ZWy_M-qBdI",
// });

// export default cloudinary;
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// โหลด .env เฉพาะตอนรันในเครื่อง (Render ไม่ต้อง)
// if (process.env.NODE_ENV !== "production") {
//   dotenv.config();
// }

//โหลดตลอดไม่ต้องเช็ค
dotenv.config();

// ใช้ชื่อ Key ตามที่ตั้งใน Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
  secure: true,
});

console.log("🧩 Render Cloudinary Config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
});

export default cloudinary;

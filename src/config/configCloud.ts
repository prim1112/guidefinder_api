// ❌ ไม่ใช้แล้ว (hardcode key อันตราย + ไม่ใช้ .env)
// import { v2 as cloudinary } from "cloudinary";

// cloudinary.config({
//   cloud_name: "dzh4fprev",
//   api_key: "682727128739815",
//   api_secret: "8wLeqgpZ756NRnls5ZWy_M-qBdI",
// });

// export default cloudinary;


import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// ❌ ไม่ต้องเช็ค production แล้ว (ทำให้ env ไม่โหลด)
// if (process.env.NODE_ENV !== "production") {
//   dotenv.config();
// }

// ✅ ใช้อันนี้ตัวเดียว โหลด .env ตลอด
dotenv.config();


// ✅ ใช้ค่าจาก .env เท่านั้น
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
  secure: true,
});


// ✅ log เช็ค (เอาไว้ debug)
console.log("🧩 Cloudinary Config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
});


export default cloudinary;
"use strict";
// import { v2 as cloudinary } from "cloudinary";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// cloudinary.config({
//   cloud_name: "dzh4fprev",
//   api_key: "682727128739815",
//   api_secret: "8wLeqgpZ756NRnls5ZWy_M-qBdI",
// });
// export default cloudinary;
const cloudinary_1 = require("cloudinary");
const dotenv_1 = __importDefault(require("dotenv"));
// โหลด .env เฉพาะตอนรันในเครื่อง (Render ไม่ต้อง)
if (process.env.NODE_ENV !== "production") {
    dotenv_1.default.config();
}
// ใช้ชื่อ Key ตามที่ตั้งใน Render
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
console.log("🧩 Render Cloudinary Config:", {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
    api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
});
exports.default = cloudinary_1.v2;
//# sourceMappingURL=configCloud.js.map
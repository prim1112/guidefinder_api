"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const streamifier_1 = __importDefault(require("streamifier"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const configCloud_1 = __importDefault(require("../src/config/configCloud"));
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// ✅ ฟังก์ชันอัปโหลดรูปขึ้น Cloudinary
const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = configCloud_1.default.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error)
            reject(error);
        else
            resolve(result);
    });
    streamifier_1.default.createReadStream(buffer).pipe(stream);
});
// ✅ Register Guide (อัปโหลด 3 รูป)
exports.router.post("/register", upload.fields([
    { name: "image_guide", maxCount: 1 },
    { name: "tourism_guide_license", maxCount: 1 },
    { name: "tourism_business_license", maxCount: 1 },
]), async (req, res) => {
    const { name, phone, email, password, facebook, language } = req.body;
    let imageGuideUrl = "";
    let guideLicenseUrl = "";
    let businessLicenseUrl = "";
    try {
        // 🔍 ตรวจสอบอีเมลซ้ำในทั้ง guide และ customer
        const [emailRows] = await dbconnect_1.default.execute(`SELECT email FROM guide WHERE email = ?
         UNION 
         SELECT email FROM customer WHERE email = ?`, [email, email]);
        if (emailRows.length > 0) {
            return res.status(400).json({
                message: "❌ อีเมลนี้ถูกใช้งานแล้ว (ซ้ำกับ Guide หรือ Customer)",
            });
        }
        // ✅ Hash password
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // ✅ อัปโหลดรูปทั้งหมด
        const files = req.files;
        if (files?.image_guide?.[0]) {
            const result = await uploadToCloudinary(files.image_guide[0].buffer, "guides/profile");
            imageGuideUrl = result.secure_url;
        }
        if (files?.tourism_guide_license?.[0]) {
            const result = await uploadToCloudinary(files.tourism_guide_license[0].buffer, "guides/licenses");
            guideLicenseUrl = result.secure_url;
        }
        if (files?.tourism_business_license?.[0]) {
            const result = await uploadToCloudinary(files.tourism_business_license[0].buffer, "guides/business");
            businessLicenseUrl = result.secure_url;
        }
        // ✅ บันทึกข้อมูลลงฐานข้อมูล
        const [insertResult] = await dbconnect_1.default.execute(`INSERT INTO guide 
        (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            name,
            phone,
            email,
            hashedPassword,
            facebook,
            language,
            imageGuideUrl,
            guideLicenseUrl,
            businessLicenseUrl,
            "pending", // default
        ]);
        res.json({
            message: "✅ Guide registered successfully",
            gid: insertResult.insertId,
            uploads: {
                image_guide: imageGuideUrl,
                tourism_guide_license: guideLicenseUrl,
                tourism_business_license: businessLicenseUrl,
            },
        });
    }
    catch (err) {
        console.error("Error in register guide:", err);
        res.status(500).json({ message: "❌ Server error", error: err.message });
    }
});
// ✅ ดึงรายชื่อไกด์ทั้งหมด
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM guide");
        const guides = rows.map((g) => {
            const { password, ...rest } = g;
            return rest;
        });
        res.json(guides);
    }
    catch (err) {
        res.status(500).json({ message: "❌ Server error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=guide.js.map
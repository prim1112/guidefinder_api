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
// ✅ ดึงรายชื่อไกด์ทั้งหมด
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM guides");
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
// ✅ สมัครไกด์ (บันทึกลง guide_pending)
exports.router.post("/register_guides", upload.fields([
    { name: "guides_imageprofile", maxCount: 1 },
    { name: "guides_imagelicense", maxCount: 1 },
    { name: "guides_image_business_license", maxCount: 1 },
]), async (req, res) => {
    const { guides_name, guides_phonenumber, guides_email, guides_password, guides_facebook, guides_language, guides_maxcus, guides_pricepercusperday, guides_province, } = req.body;
    try {
        const [existing] = await dbconnect_1.default.execute("SELECT guides_email FROM guides WHERE guides_email = ? OR guides_phonenumber = ?", [guides_email, guides_phonenumber]);
        if (existing.length > 0)
            return res
                .status(400)
                .json({ message: "❌ อีเมลหรือเบอร์โทรนี้มีในระบบแล้ว" });
        const files = req.files;
        const imageGuideUrl = files?.guides_imageprofile
            ? (await uploadToCloudinary(files.guides_imageprofile[0].buffer, "guides/profile")).secure_url
            : "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";
        const guideLicenseUrl = files?.guides_imagelicense
            ? (await uploadToCloudinary(files.guides_imagelicense[0].buffer, "guides/licenses")).secure_url
            : null;
        const businessLicenseUrl = files?.guides_image_business_license
            ? (await uploadToCloudinary(files.guides_image_business_license[0].buffer, "guides/business")).secure_url
            : null;
        const hashedPassword = await bcrypt_1.default.hash(guides_password, 10);
        const [insertResult] = await dbconnect_1.default.execute(`INSERT INTO guides 
        (guides_name, guides_phonenumber, guides_email, guides_password, 
        guides_facebook, guides_language, guides_imageprofile, guides_imagelicense, 
        guides_image_business_license, guides_province, guides_maxcus, guides_pricepercusperday, guides_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            guides_name || null,
            guides_phonenumber || null,
            guides_email || null,
            hashedPassword || null,
            guides_facebook || null,
            guides_language || null,
            imageGuideUrl, // profile
            guideLicenseUrl, // license
            businessLicenseUrl, // business license
            guides_province || null,
            guides_maxcus || 0,
            guides_pricepercusperday || 0,
            0, // guides_status
        ]);
        res.json({
            message: "🕒 ลงทะเบียนสำเร็จ! รอการอนุมัติ",
            gid: insertResult.insertId,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "❌ Error", error: err.message });
    }
});
// ✅ อนุมัติไกด์ (ย้ายจาก guide_pending → guide)
exports.router.post("/approve/:gid", async (req, res) => {
    const { gid } = req.params;
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM guide_pending WHERE gid = ?", [gid]);
        if (rows.length === 0) {
            return res
                .status(404)
                .json({ message: "❌ ไม่พบข้อมูลใน guide_pending" });
        }
        const guide = rows[0];
        await dbconnect_1.default.execute(`INSERT INTO guide 
      (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            guide.name ?? null,
            guide.phone ?? null,
            guide.email ?? null,
            guide.password ?? null,
            guide.facebook ?? null,
            guide.language ?? null,
            guide.image_guide ?? null,
            guide.tourism_guide_license ?? null,
            guide.tourism_business_license ?? null,
        ]);
        await dbconnect_1.default.execute("DELETE FROM guide_pending WHERE gid = ?", [gid ?? null]);
        res.json({
            message: "✅ อนุมัติสำเร็จ และย้ายข้อมูลไปยังตาราง Guide แล้ว",
            moved_data: {
                name: guide.name,
                email: guide.email,
                phone: guide.phone,
            },
        });
    }
    catch (err) {
        console.error("Error in approve guide:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ❌ ปฏิเสธไกด์ (ลบออกจาก guide_pending โดยไม่ย้ายไป guide)
exports.router.delete("/reject/:gid", async (req, res) => {
    const { gid } = req.params;
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM guide_pending WHERE gid = ?", [gid]);
        if (rows.length === 0) {
            return res
                .status(404)
                .json({ message: "❌ ไม่พบข้อมูลใน guide_pending" });
        }
        const guide = rows[0];
        await dbconnect_1.default.execute("DELETE FROM guide_pending WHERE gid = ?", [gid ?? null]);
        res.json({
            message: "🗑️ ลบข้อมูลไกด์ที่สมัครมา (ไม่อนุมัติ) เรียบร้อยแล้ว",
            deleted_data: {
                name: guide.name,
                email: guide.email,
                phone: guide.phone,
            },
        });
    }
    catch (err) {
        console.error("Error in reject guide:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=guide.js.map
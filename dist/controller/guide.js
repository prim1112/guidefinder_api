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
// ✅ สมัครไกด์ (บันทึกลง guide_pending)
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
        // 🔍 ตรวจสอบอีเมลซ้ำ
        const [emailRows] = await dbconnect_1.default.execute(`SELECT email FROM guide WHERE email = ?
         UNION
         SELECT email FROM guide_pending WHERE email = ?
         UNION
         SELECT email FROM customer WHERE email = ?`, [email, email, email]);
        if (emailRows.length > 0) {
            return res.status(400).json({
                message: "❌ อีเมลนี้ถูกใช้งานแล้ว (ซ้ำกับ Guide, Pending หรือ Customer)",
            });
        }
        // 🔍 ตรวจสอบเบอร์โทรซ้ำ
        const [phoneRows] = await dbconnect_1.default.execute(`SELECT phone FROM guide WHERE phone = ?
         UNION
         SELECT phone FROM guide_pending WHERE phone = ?
         UNION
         SELECT phone FROM customer WHERE phone = ?`, [phone, phone, phone]);
        if (phoneRows.length > 0) {
            return res.status(400).json({
                message: "❌ เบอร์โทรนี้ถูกใช้งานแล้ว (ซ้ำกับ Guide, Pending หรือ Customer)",
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
        // ✅ บันทึกข้อมูลลง guide_pending (รออนุมัติ)
        const [insertResult] = await dbconnect_1.default.execute(`INSERT INTO guide_pending 
        (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            name ?? null,
            phone ?? null,
            email ?? null,
            hashedPassword ?? null,
            facebook ?? null,
            language ?? null,
            imageGuideUrl ?? null,
            guideLicenseUrl ?? null,
            businessLicenseUrl ?? null,
        ]);
        res.json({
            message: "🕒 Guide registered successfully (รอการอนุมัติจากแอดมิน)",
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
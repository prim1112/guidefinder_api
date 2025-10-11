"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
exports.handleResponse = handleResponse;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const streamifier_1 = __importDefault(require("streamifier"));
const bcrypt_1 = __importDefault(require("bcrypt")); // ✅ เพิ่ม bcrypt
const configCloud_1 = __importDefault(require("../src/config/configCloud"));
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// ✅ ฟังก์ชันอัปโหลดภาพขึ้น Cloudinary
const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = configCloud_1.default.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error)
            reject(error);
        else
            resolve(result);
    });
    streamifier_1.default.createReadStream(buffer).pipe(stream);
});
// ✅ ทดสอบ Cloudinary
exports.router.get("/test-cloudinary", (req, res) => {
    res.json({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
        api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
    });
});
// ✅ ดึงข้อมูลลูกค้าทั้งหมด
exports.router.get("/customers", (req, res) => {
    const sql = "SELECT * FROM customer";
    dbconnect_1.default.query(sql, (err, rows) => {
        if (err)
            return handleResponse(res, err);
        const sanitizedRows = rows.map((row) => {
            const { password, ...sanitized } = row;
            return sanitized;
        });
        handleResponse(res, null, sanitizedRows);
    });
});
// ✅ ตรวจสอบเบอร์โทรซ้ำ
exports.router.post("/customers_check-phone", async (req, res) => {
    const { phone } = req.body;
    const [rows] = await dbconnect_1.default.execute("SELECT cid FROM customer WHERE phone = ?", [phone]);
    if (rows.length > 0) {
        return res.status(400).json({ message: "❌ เบอร์โทรนี้ถูกใช้งานแล้ว" });
    }
    res.json({ message: "✅ ใช้เบอร์นี้ได้" });
});
// ✅ Register Customer
exports.router.post("/customers", upload.single("image_customer"), async (req, res) => {
    const { name, phone, email, password } = req.body;
    let imageUrl = "";
    try {
        // 🔍 ตรวจเบอร์ซ้ำ
        const [phoneRows] = await dbconnect_1.default.execute("SELECT cid FROM customer WHERE phone = ?", [phone]);
        if (phoneRows.length > 0) {
            return res
                .status(400)
                .json({ message: "❌ เบอร์โทรนี้มีอยู่ในระบบแล้ว" });
        }
        // 🔍 ตรวจอีเมลซ้ำในทั้ง customer และ guide
        const [emailRows] = await dbconnect_1.default.execute(`SELECT email FROM customer WHERE email = ?
         UNION
         SELECT email FROM guide WHERE email = ?`, [email, email]);
        if (emailRows.length > 0) {
            return res
                .status(400)
                .json({
                message: "❌ อีเมลนี้ถูกใช้งานแล้ว (ซ้ำกับ Customer หรือ Guide)",
            });
        }
        // ✅ เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // ✅ อัปโหลดรูป (เฉพาะถ้าไม่ซ้ำ)
        if (req.file && req.file.buffer) {
            const result = await uploadToCloudinary(req.file.buffer, "customers");
            imageUrl = result.secure_url;
        }
        // ✅ บันทึกลงฐานข้อมูล
        const [insertResult] = await dbconnect_1.default.execute("INSERT INTO customer (name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?)", [name, phone, email, imageUrl, hashedPassword]);
        res.json({
            message: "✅ Register successfully",
            id: insertResult.insertId,
        });
    }
    catch (err) {
        console.error("Error in register:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ✅ Login (ตรวจสอบรหัสผ่านที่ถูกเข้ารหัส)
exports.router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        // ✅ ตรวจว่ากรอกครบไหม
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอก Email และ Password" });
        }
        // ✅ ค้นหาผู้ใช้จาก Email
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM customer WHERE email = ?", [email]);
        const user = rows[0];
        if (!user) {
            return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
        }
        // ✅ ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
        }
        // ✅ สำเร็จ → ส่งข้อมูลกลับ (ไม่ส่งรหัสผ่าน)
        res.json({
            message: "✅ Login สำเร็จ",
            user: {
                cid: user.cid,
                name: user.name,
                phone: user.phone,
                email: user.email,
                image_customer: user.image_customer,
            },
        });
    }
    catch (err) {
        console.error("Error in login:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ✅ Helper ฟังก์ชันตอบกลับ API
function handleResponse(res, err, data, notFoundStatusCode = 404, notFoundMessage = "Not found", affectedRows = null) {
    if (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    if (!data && !affectedRows) {
        res.status(notFoundStatusCode).json({ error: notFoundMessage });
        return;
    }
    res.json(data);
}
//# sourceMappingURL=customer.js.map
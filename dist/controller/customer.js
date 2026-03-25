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
const bcrypt_1 = __importDefault(require("bcrypt"));
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
exports.router.get("/test-cloudinary", (req, res) => {
    res.json({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
        api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
    });
});
// ✅ ดึงข้อมูลลูกค้าทั้งหมด
exports.router.get("/customers", (req, res) => {
    const sql = "SELECT * FROM customers";
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
// ✅ Register Customer
exports.router.post("/register_customers", upload.single("cus_imageprofile"), async (req, res) => {
    const { cus_name, cus_phonenumber, cus_email, cus_password } = req.body;
    let cus_imageprofile = " ";
    try {
        // 🔍 ตรวจเบอร์ซ้ำ
        const [phoneRows] = await dbconnect_1.default.execute("SELECT cus_phonenumber FROM customers WHERE cus_phonenumber = ?", [cus_phonenumber]);
        if (phoneRows.length > 0) {
            return res
                .status(400)
                .json({ message: "❌ เบอร์โทรนี้มีอยู่ในระบบแล้ว" });
        }
        // 🔍 ตรวจอีเมลซ้ำในทั้ง customer และ guide
        const [emailRows] = await dbconnect_1.default.execute(`SELECT cus_email FROM customer WHERE cus_email = ?`, [cus_email, cus_email]);
        if (emailRows.length > 0) {
            return res.status(400).json({
                message: "❌ อีเมลนี้ถูกใช้งานแล้ว",
            });
        }
        // ✅ เข้ารหัสรหัสผ่านก่อนบันทึก
        const hashedPassword = await bcrypt_1.default.hash(cus_password, 10);
        // ✅ อัปโหลดรูป (เฉพาะถ้าไม่ซ้ำ)
        if (req.file && req.file.buffer) {
            const result = await uploadToCloudinary(req.file.buffer, "customers");
            cus_imageprofile = result.secure_url;
        }
        // ✅ บันทึกลงฐานข้อมูล
        const [insertResult] = await dbconnect_1.default.execute("INSERT INTO customerห (cus_name, cus_phonenumber, cus_email, cus_imageprofile, hashedPassword) VALUES (?, ?, ?, ?, ?)", [
            cus_name,
            cus_phonenumber,
            cus_email,
            cus_imageprofile,
            hashedPassword,
        ]);
        res.json({
            message: "✅ สมัครสมาชิกสำเร็จ",
            id: insertResult.insertId,
        });
    }
    catch (err) {
        console.error("Error in register:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// // ✅ Login (ตรวจสอบรหัสผ่านที่ถูกเข้ารหัส)
// router.post("/login", async (req: Request, res: Response) => {
//   const { email, password } = req.body;
//   try {
//     // ✅ ตรวจว่ากรอกครบไหม
//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "❌ กรุณากรอก Email และ Password" });
//     }
//     // ✅ ค้นหาผู้ใช้จาก Email
//     const [rows] = await db.execute<RowDataPacket[]>(
//       "SELECT * FROM customer WHERE email = ?",
//       [email],
//     );
//     const user = rows[0];
//     if (!user) {
//       return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
//     }
//     // ✅ ตรวจสอบรหัสผ่าน
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
//     }
//     // ✅ สำเร็จ → ส่งข้อมูลกลับ (ไม่ส่งรหัสผ่าน)
//     res.json({
//       message: "✅ Login สำเร็จ",
//       user: {
//         cid: user.cid,
//         name: user.name,
//         phone: user.phone,
//         email: user.email,
//         image_customer: user.image_customer,
//       },
//     });
//   } catch (err: any) {
//     console.error("Error in login:", err);
//     res.status(500).json({ message: "❌ Server Error", error: err.message });
//   }
// });
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
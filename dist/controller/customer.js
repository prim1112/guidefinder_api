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
const configCloud_1 = __importDefault(require("../src/config/configCloud"));
// import uploadToCloud from "../src/config/uploadToCloudinary";
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
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
exports.router.post("/customers_checkphone", async (req, res) => {
    const { phone } = req.body;
    const [rows] = await dbconnect_1.default.execute("SELECT cid FROM customer WHERE phone = ?", [phone]);
    if (rows.length > 0) {
        return res.status(400).json({ message: "❌ เบอร์โทรนี้ถูกใช้งานแล้ว" });
    }
    res.json({ message: "✅ ใช้เบอร์นี้ได้" });
});
exports.router.post("/customers", upload.single("image_customer"), async (req, res) => {
    const { name, phone, email, password } = req.body;
    let imageUrl = "";
    // ดักเบอร์ซ้ำ
    const [rows] = await dbconnect_1.default.execute("SELECT cid FROM customer WHERE phone = ?", [phone]);
    if (rows.length > 0) {
        return res
            .status(400)
            .json({ message: "❌ เบอร์โทรนี้มีอยู่ในระบบแล้ว" });
    }
    // อัปโหลดรูป (เฉพาะถ้าไม่ซ้ำ)
    if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
    }
    const [insertResult] = await dbconnect_1.default.execute("INSERT INTO customer (name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?)", [name, phone, email, imageUrl, password]);
    res.json({
        message: "✅ Customer created successfully",
        id: insertResult.insertId,
    });
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
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
const cloudinary_1 = require("cloudinary");
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error)
            reject(error);
        else
            resolve(result);
    });
    streamifier_1.default.createReadStream(buffer).pipe(stream);
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
// ✅ เพิ่มลูกค้าใหม่ (อัปโหลดรูปขึ้น Cloudinary)
exports.router.post("/customers", upload.single("image_customer"), async (req, res) => {
    try {
        const { cid, name, phone, email, password } = req.body;
        let imageUrl = "";
        if (req.file && req.file.buffer) {
            const result = await uploadToCloudinary(req.file.buffer, "customers");
            imageUrl = result.secure_url;
        }
        const sql = "INSERT INTO customer (cid, name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?, ?)";
        dbconnect_1.default.query(sql, [cid, name, phone, email, imageUrl, password], (err, result) => {
            if (err)
                return handleResponse(res, err, null, 500, "Failed to create customer");
            handleResponse(res, null, {
                message: "✅ Customer created successfully",
                id: result.insertId,
            });
        });
    }
    catch (error) {
        console.error("❌ Upload Error:", error);
        res.status(500).json({ message: "Upload failed", error: error.message });
    }
});
// Helper function to handle API responses
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
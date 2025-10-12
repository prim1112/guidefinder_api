"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const streamifier_1 = __importDefault(require("streamifier"));
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
// ✅ POST: เพิ่มข้อมูลสถานที่ (Location)
exports.router.post("/location", upload.single("image"), async (req, res) => {
    const { name, address, subdistrict, district, province, typeid } = req.body;
    let imageUrl = "";
    try {
        // 🔍 ตรวจสอบค่าที่จำเป็น
        if (!name ||
            !address ||
            !subdistrict ||
            !district ||
            !province ||
            !typeid) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
        }
        // 🔍 ตรวจสอบว่า typeid มีอยู่ในตาราง LocationType หรือไม่
        const [typeRows] = await dbconnect_1.default.execute("SELECT type_id FROM locationtype WHERE type_id = ?", [typeid]);
        if (typeRows.length === 0) {
            return res
                .status(400)
                .json({ message: "❌ typeid ไม่ถูกต้อง หรือไม่มีอยู่ในระบบ" });
        }
        // ✅ อัปโหลดรูปขึ้น Cloudinary
        if (req.file && req.file.buffer) {
            const result = await uploadToCloudinary(req.file.buffer, "locations");
            imageUrl = result.secure_url;
        }
        // ✅ บันทึกข้อมูลลงฐานข้อมูล
        const [result] = await dbconnect_1.default.execute(`INSERT INTO location (name, address, subdistrict, district, province, image, typeid)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, address, subdistrict, district, province, imageUrl, typeid]);
        res.json({
            message: "✅ เพิ่มข้อมูล Location สำเร็จ",
            location_id: result.insertId,
            data: {
                name,
                address,
                subdistrict,
                district,
                province,
                image: imageUrl,
                typeid,
            },
        });
    }
    catch (err) {
        console.error("Error in POST /location:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ✅ GET: ดึงข้อมูลทั้งหมดจาก Location
exports.router.get("/location", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM location");
        res.json(rows);
    }
    catch (err) {
        console.error("Error in GET /location:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.router.post("/location_type", async (req, res) => {
    const { nametype } = req.body;
    try {
        if (!nametype) {
            return res.status(400).json({ message: "❌ กรุณากรอก nametype" });
        }
        const [result] = await dbconnect_1.default.execute("INSERT INTO locationtype (nametype) VALUES (?)", [nametype]);
        res.json({
            message: "✅ เพิ่มข้อมูล LocationType สำเร็จ",
            type_id: result.insertId,
            nametype,
        });
    }
    catch (err) {
        console.error("Error in POST /location_type:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
/* ✅ GET: ดึงข้อมูลทั้งหมดจาก LocationType */
exports.router.get("/location_type", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM locationtype");
        res.json(rows);
    }
    catch (err) {
        console.error("Error in GET /location_type:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=location.js.map
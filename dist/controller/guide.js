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
//  Cloudinary
const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = configCloud_1.default.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error)
            reject(error);
        else
            resolve(result);
    });
    streamifier_1.default.createReadStream(buffer).pipe(stream);
});
// get guides
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.query("SELECT * FROM guides");
        const guides = rows.map(({ password, ...rest }) => rest);
        return res.json({
            message: "ดึงข้อมูล Guides สำเร็จ",
            count: guides.length,
            data: guides,
        });
    }
    catch (error) {
        console.error("GET /guides error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
// register guide
exports.router.post("/register_guides", upload.fields([
    { name: "guides_imageprofile", maxCount: 1 },
    { name: "guides_imagelicense", maxCount: 1 },
    { name: "guides_image_business_license", maxCount: 1 },
]), async (req, res) => {
    const { guides_name, guides_phonenumber, guides_email, guides_password, guides_facebook, guides_language, guides_maxcus, guides_pricepercusperday, guides_province, } = req.body;
    try {
        // 🔍 validate
        if (!guides_email || !guides_password || !guides_phonenumber) {
            return res.status(400).json({
                message: "กรุณากรอก email, password และเบอร์โทร",
            });
        }
        // 🔍 check duplicate
        const [existing] = await dbconnect_1.default.query("SELECT guides_email FROM guides WHERE guides_email = ? OR guides_phonenumber = ?", [guides_email, guides_phonenumber]);
        if (existing.length) {
            return res.status(400).json({
                message: "อีเมลหรือเบอร์โทรนี้มีในระบบแล้ว",
            });
        }
        const files = req.files;
        //upload image
        const uploadImage = async (file, path) => {
            if (!file)
                return null;
            const result = await uploadToCloudinary(file.buffer, path);
            return result.secure_url;
        };
        const imageGuideUrl = (await uploadImage(files?.guides_imageprofile?.[0], "guides/profile")) ||
            "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";
        const guideLicenseUrl = await uploadImage(files?.guides_imagelicense?.[0], "guides/licenses");
        const businessLicenseUrl = await uploadImage(files?.guides_image_business_license?.[0], "guides/business");
        //hash password
        const hashedPassword = await bcrypt_1.default.hash(guides_password, 10);
        // insert
        const [result] = await dbconnect_1.default.query(`INSERT INTO guides 
        (guides_name, guides_phonenumber, guides_email, guides_password, 
        guides_facebook, guides_language, guides_imageprofile, guides_imagelicense, 
        guides_image_business_license, guides_province, guides_maxcus, guides_pricepercusperday, guides_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            guides_name || null,
            guides_phonenumber,
            guides_email,
            hashedPassword,
            guides_facebook || null,
            guides_language || null,
            imageGuideUrl,
            guideLicenseUrl,
            businessLicenseUrl,
            guides_province || null,
            guides_maxcus ?? 0,
            guides_pricepercusperday ?? 0,
            0,
        ]);
        return res.status(201).json({
            message: "ลงทะเบียนสำเร็จ! รอการอนุมัติ",
            gid: result.insertId,
        });
    }
    catch (error) {
        console.error("POST /register_guides error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
// accept guide_pending → guide
exports.router.post("/approve/:gid", async (req, res) => {
    const { gid } = req.params;
    const conn = await dbconnect_1.default.getConnection(); // ใช้ transaction
    try {
        await conn.beginTransaction();
        // get data from pending
        const [rows] = await conn.query("SELECT * FROM guide_pending WHERE gid = ?", [gid]);
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({
                message: "ไม่พบข้อมูลใน guide_pending",
            });
        }
        const guide = rows[0];
        // insert 
        await conn.query(`INSERT INTO guide 
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
        // delete from pending
        await conn.query("DELETE FROM guide_pending WHERE gid = ?", [gid]);
        await conn.commit();
        return res.json({
            message: "อนุมัติสำเร็จ และย้ายข้อมูลแล้ว",
            moved_data: {
                name: guide.name,
                email: guide.email,
                phone: guide.phone,
            },
        });
    }
    catch (error) {
        await conn.rollback();
        console.error("POST /approve/:gid error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
    finally {
        conn.release();
    }
});
// reject  guide_pending 
exports.router.delete("/reject/:gid", async (req, res) => {
    const { gid } = req.params;
    try {
        // chack data 
        const [rows] = await dbconnect_1.default.query("SELECT name, email, phone FROM guide_pending WHERE gid = ?", [gid]);
        if (!rows.length) {
            return res.status(404).json({
                message: "ไม่พบข้อมูลใน guide_pending",
            });
        }
        const guide = rows[0];
        await dbconnect_1.default.query("DELETE FROM guide_pending WHERE gid = ?", [gid]);
        return res.json({
            message: "ลบข้อมูลไกด์ที่สมัครมาเรียบร้อยแล้ว",
            deleted_data: {
                name: guide.name,
                email: guide.email,
                phone: guide.phone,
            },
        });
    }
    catch (error) {
        console.error("DELETE /reject/:gid error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
exports.default = exports.router;
//# sourceMappingURL=guide.js.map
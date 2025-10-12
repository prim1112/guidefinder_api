"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
// ✅ เพิ่มแพ็กเกจจังหวัด (province_package)
exports.router.post("/province_package", async (req, res) => {
    const { gid, province, max_people, price_per_person } = req.body;
    try {
        // 🔍 ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
        if (!gid || !province || !max_people || !price_per_person) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
        }
        // 🔍 ตรวจสอบว่า gid มีอยู่ในตาราง guide หรือไม่
        const [guideRows] = await dbconnect_1.default.execute("SELECT gid FROM guide WHERE gid = ?", [gid]);
        if (guideRows.length === 0) {
            return res.status(400).json({
                message: "❌ ไม่พบไกด์ในระบบ กรุณาใช้ gid ที่ถูกต้อง",
            });
        }
        // 🔍 ตรวจสอบว่าไกด์คนนี้มี package อยู่แล้วหรือยัง
        const [packageRows] = await dbconnect_1.default.execute("SELECT package_id FROM province_package WHERE gid = ?", [gid]);
        if (packageRows.length > 0) {
            return res.status(400).json({
                message: "❌ ไกด์คนนี้มีแพ็กเกจอยู่แล้ว ไม่สามารถเพิ่มซ้ำได้",
            });
        }
        // ✅ บันทึกข้อมูลลงตาราง province_package
        const [result] = await dbconnect_1.default.execute(`INSERT INTO province_package (gid, province, max_people, price_per_person)
       VALUES (?, ?, ?, ?)`, [gid, province, max_people, price_per_person]);
        res.json({
            message: "✅ เพิ่มข้อมูล province_package สำเร็จ",
            package_id: result.insertId,
            data: {
                gid,
                province,
                max_people,
                price_per_person,
            },
        });
    }
    catch (err) {
        console.error("Error in POST /province_package:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=package.js.map
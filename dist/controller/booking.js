"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
// ✅ GET: ดึงข้อมูล Booking ทั้งหมด
exports.router.get("/booking", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.execute("SELECT * FROM booking");
        res.json(rows);
    }
    catch (err) {
        console.error("Error in GET /booking:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ✅ GET: ดึงข้อมูล Booking ตาม gid (เฉพาะไกด์คนนั้น)
exports.router.get("/booking/:gid", async (req, res) => {
    const { gid } = req.params;
    try {
        // 🔍 ตรวจว่า gid มีอยู่ในระบบ guide หรือไม่
        const [guideRows] = await dbconnect_1.default.execute("SELECT gid FROM guide WHERE gid = ?", [gid]);
        if (guideRows.length === 0) {
            return res.status(400).json({ message: "❌ ไม่พบ gid ในระบบ guide" });
        }
        // ✅ ดึง booking ทั้งหมดของไกด์คนนั้น
        const [bookings] = await dbconnect_1.default.execute("SELECT * FROM booking WHERE gid = ?", [gid]);
        if (bookings.length === 0) {
            return res
                .status(404)
                .json({ message: "ℹ️ ยังไม่มีการจองสำหรับไกด์คนนี้" });
        }
        res.json({
            message: "✅ ดึงข้อมูล Booking ของไกด์สำเร็จ",
            count: bookings.length,
            data: bookings,
        });
    }
    catch (err) {
        console.error("Error in GET /booking/:gid:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
// ✅ POST: เพิ่มข้อมูลใหม่ใน Booking
exports.router.post("/booking", async (req, res) => {
    const { gid, cid, location_id, people, start_date, end_date, status, total_price, } = req.body;
    try {
        // 🔍 ตรวจสอบค่าที่จำเป็น
        if (!gid ||
            !cid ||
            !location_id ||
            !people ||
            !start_date ||
            !end_date ||
            !status ||
            !total_price) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
        }
        // 🔍 ตรวจว่า gid มีในตาราง guide หรือไม่
        const [guideRows] = await dbconnect_1.default.execute("SELECT gid FROM guide WHERE gid = ?", [gid]);
        if (guideRows.length === 0) {
            return res.status(400).json({ message: "❌ ไม่พบ gid ในระบบ guide" });
        }
        // 🔍 ตรวจว่า cid มีในตาราง customer หรือไม่
        const [customerRows] = await dbconnect_1.default.execute("SELECT cid FROM customer WHERE cid = ?", [cid]);
        if (customerRows.length === 0) {
            return res.status(400).json({ message: "❌ ไม่พบ cid ในระบบ customer" });
        }
        // 🔍 ตรวจว่า location_id มีในตาราง location หรือไม่
        const [locationRows] = await dbconnect_1.default.execute("SELECT location_id FROM location WHERE location_id = ?", [location_id]);
        if (locationRows.length === 0) {
            return res
                .status(400)
                .json({ message: "❌ ไม่พบ location_id ในระบบ location" });
        }
        // ✅ บันทึกข้อมูลลงฐานข้อมูล
        const [result] = await dbconnect_1.default.execute(`INSERT INTO booking 
      (gid, cid, location_id, people, start_date, end_date, status, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [gid, cid, location_id, people, start_date, end_date, status, total_price]);
        res.json({
            message: "✅ เพิ่มข้อมูล Booking สำเร็จ",
            booking_id: result.insertId,
            data: {
                gid,
                cid,
                location_id,
                people,
                start_date,
                end_date,
                status,
                total_price,
            },
        });
    }
    catch (err) {
        console.error("Error in POST /booking:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=booking.js.map
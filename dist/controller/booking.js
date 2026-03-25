"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
// get all booking
exports.router.get("/booking", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.default.query("SELECT * FROM booking");
        return res.json({
            message: "ดึงข้อมูล Booking สำเร็จ",
            count: rows.length,
            data: rows,
        });
    }
    catch (error) {
        console.error("GET /booking error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
exports.router.get("/booking/:gid", async (req, res) => {
    const gid = req.params.gid;
    try {
        // check gid is existd
        const [guideRows] = await dbconnect_1.default.query(`SELECT gid FROM guide WHERE gid = '${gid}'`);
        if (!guideRows.length) {
            return res.status(400).json({
                message: "ไม่พบ gid ในระบบ guide",
            });
        }
        const [bookings] = await dbconnect_1.default.query(`SELECT * FROM booking WHERE gid = '${gid}'`);
        if (!bookings.length) {
            return res.status(404).json({
                message: "ยังไม่มีการจองสำหรับไกด์คนนี้",
            });
        }
        return res.json({
            message: "ดึงข้อมูล Booking ของไกด์สำเร็จ",
            count: bookings.length,
            data: bookings,
        });
    }
    catch (error) {
        console.error("GET /booking/:gid error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
exports.router.post("/booking", async (req, res) => {
    const { gid, cid, location_id, people, start_date, end_date, status, total_price, } = req.body;
    try {
        // required fields
        if (!gid ||
            !cid ||
            !location_id ||
            !people ||
            !start_date ||
            !end_date ||
            !status ||
            !total_price) {
            return res.status(400).json({
                message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
            });
        }
        const checkExist = async (sql, value) => {
            const [rows] = await dbconnect_1.default.query(sql, [value]);
            return rows.length > 0;
        };
        if (!(await checkExist("SELECT gid FROM guide WHERE gid = ?", gid))) {
            return res.status(400).json({ message: "ไม่พบ gid ในระบบ guide" });
        }
        if (!(await checkExist("SELECT cid FROM customer WHERE cid = ?", cid))) {
            return res.status(400).json({ message: "ไม่พบ cid ในระบบ customer" });
        }
        if (!(await checkExist("SELECT location_id FROM location WHERE location_id = ?", location_id))) {
            return res
                .status(400)
                .json({ message: "ไม่พบ location_id ในระบบ location" });
        }
        // insert booking database 
        const [result] = await dbconnect_1.default.query(`INSERT INTO booking 
      (gid, cid, location_id, people, start_date, end_date, status, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [gid, cid, location_id, people, start_date, end_date, status, total_price]);
        return res.json({
            message: "เพิ่มข้อมูล Booking สำเร็จ",
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
    catch (error) {
        console.error("POST /booking error:", error);
        return res.status(500).json({
            message: "Server Error",
            error: error.message,
        });
    }
});
exports.default = exports.router;
//# sourceMappingURL=booking.js.map
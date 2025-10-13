import { Request, Response, Router } from "express";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();

// ✅ GET: ดึงข้อมูล Booking ทั้งหมด
router.get("/booking", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM booking");
    res.json(rows);
  } catch (err: any) {
    console.error("Error in GET /booking:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

// ✅ GET: ดึงข้อมูล Booking ตาม gid (เฉพาะไกด์คนนั้น)
router.get("/booking/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    // 🔍 ตรวจว่า gid มีอยู่ในระบบ guide หรือไม่
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT gid FROM guide WHERE gid = ?",
      [gid]
    );

    if (guideRows.length === 0) {
      return res.status(400).json({ message: "❌ ไม่พบ gid ในระบบ guide" });
    }

    // ✅ ดึง booking ทั้งหมดของไกด์คนนั้น
    const [bookings] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM booking WHERE gid = ?",
      [gid]
    );

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
  } catch (err: any) {
    console.error("Error in GET /booking/:gid:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

// ✅ POST: เพิ่มข้อมูลใหม่ใน Booking
router.post("/booking", async (req: Request, res: Response) => {
  const {
    gid,
    cid,
    location_id,
    people,
    start_date,
    end_date,
    status,
    total_price,
  } = req.body;

  try {
    // 🔍 ตรวจสอบค่าที่จำเป็น
    if (
      !gid ||
      !cid ||
      !location_id ||
      !people ||
      !start_date ||
      !end_date ||
      !status ||
      !total_price
    ) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    // 🔍 ตรวจว่า gid มีในตาราง guide หรือไม่
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT gid FROM guide WHERE gid = ?",
      [gid]
    );
    if (guideRows.length === 0) {
      return res.status(400).json({ message: "❌ ไม่พบ gid ในระบบ guide" });
    }

    // 🔍 ตรวจว่า cid มีในตาราง customer หรือไม่
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT cid FROM customer WHERE cid = ?",
      [cid]
    );
    if (customerRows.length === 0) {
      return res.status(400).json({ message: "❌ ไม่พบ cid ในระบบ customer" });
    }

    // 🔍 ตรวจว่า location_id มีในตาราง location หรือไม่
    const [locationRows] = await db.execute<RowDataPacket[]>(
      "SELECT location_id FROM location WHERE location_id = ?",
      [location_id]
    );
    if (locationRows.length === 0) {
      return res
        .status(400)
        .json({ message: "❌ ไม่พบ location_id ในระบบ location" });
    }

    // ✅ บันทึกข้อมูลลงฐานข้อมูล
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO booking 
      (gid, cid, location_id, people, start_date, end_date, status, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [gid, cid, location_id, people, start_date, end_date, status, total_price]
    );

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
  } catch (err: any) {
    console.error("Error in POST /booking:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

export default router;

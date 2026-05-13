import { Request, Response, Router } from "express";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();

// get all booking
router.get("/booking", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM booking");

    return res.json({
      message: "ดึงข้อมูล Booking สำเร็จ",
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    console.error("GET /booking error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});


router.get("/booking/:gid", async (req: Request, res: Response) => {
  const gid = req.params.gid;

  try {
    // check gid is existd
    const [guideRows]: any = await db.query(
      `SELECT gid FROM guide WHERE gid = '${gid}'`
    );

    if (!guideRows.length) {
      return res.status(400).json({
        message: "ไม่พบ gid ในระบบ guide",
      });
    }

    const [bookings]: any = await db.query(
      `SELECT * FROM booking WHERE gid = '${gid}'`
    );

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
  } catch (error: any) {
    console.error("GET /booking/:gid error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});


router.post("/booking", async (req: Request, res: Response) => {
  // รับค่าจาก Flutter (ฝั่ง App อาจจะส่งชื่อสั้นๆ มา)
  const {
    gid,          // ไอดีไกด์
    cid,          // ไอดีลูกค้า
    location_id,  // ไอดีสถานที่
    people,       // จำนวนคน
    start_date,   // วันที่เริ่ม (ต้องเป็น YYYY-MM-DD)
    end_date,     // วันที่สิ้นสุด (ต้องเป็น YYYY-MM-DD)
    total_price,  // ราคารวม
    status        // สถานะ (ส่งเป็นตัวเลขตามที่คุณตั้งไว้ เช่น 0)
  } = req.body;

  try {
    // 1. ตรวจสอบค่าว่าง
    if (!gid || !cid || !location_id || !people || !start_date || !end_date || total_price === undefined || status === undefined) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    // 2. ตรวจสอบความมีอยู่ของข้อมูล (Foreign Key Check)
    const checkExist = async (sql: string, value: any) => {
      const [rows]: any = await db.query(sql, [value]);
      return rows.length > 0;
    };

    if (!(await checkExist("SELECT gid FROM guide WHERE gid = ?", gid))) {
      return res.status(400).json({ message: "ไม่พบไอดีไกด์ในระบบ" });
    }
    if (!(await checkExist("SELECT cid FROM customer WHERE cid = ?", cid))) {
      return res.status(400).json({ message: "ไม่พบไอดีลูกค้าในระบบ" });
    }
    if (!(await checkExist("SELECT location_id FROM location WHERE location_id = ?", location_id))) {
      return res.status(400).json({ message: "ไม่พบสถานที่ในระบบ" });
    }

    // 3. บันทึกลงตาราง booking_queues (ใช้ชื่อฟิลด์ใหม่ตามที่คุณส่งมา)
    const [result]: any = await db.query(
      `INSERT INTO booking_queues 
      (ref_guid_id, ref_cus_id, ref_locid, booking_start_date, booking_end_date, booking_cus_amount, booking_total_price, booking_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [gid, cid, location_id, start_date, end_date, people, total_price, status]
    );

    return res.json({
      message: "เพิ่มข้อมูลลงคิวการจองสำเร็จ",
      booking_queue_id: result.insertId,
      data: {
        guide_id: gid,
        customer_id: cid,
        total: total_price,
        status: status
      }
    });

  } catch (error: any) {
    console.error("Database Error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;
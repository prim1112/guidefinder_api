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
      `SELECT gid FROM guide WHERE gid = '${gid}'`,
    );

    if (!guideRows.length) {
      return res.status(400).json({
        message: "ไม่พบ gid ในระบบ guide",
      });
    }

    const [bookings]: any = await db.query(
      `SELECT * FROM booking WHERE gid = '${gid}'`,
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
  const {
    gid,
    cid,
    travel_id, // ✅ เปลี่ยนให้ตรง ref_travel_id
    people,
    start_date,
    end_date,
    total_price,
    status,
  } = req.body;

  try {
    // 🔴 validate
    if (
      !gid ||
      !cid ||
      !travel_id ||
      !people ||
      !start_date ||
      !end_date ||
      !total_price ||
      status == null
    ) {
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    // 🔎 check guide
    const [guideRows]: any = await db.query(
      `SELECT guides_id FROM guides WHERE guides_id = ?`,
      [gid]
    );

    if (guideRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบไกด์ในระบบ" });
    }

    // 🔎 check customer
    const [cusRows]: any = await db.query(
      `SELECT cus_id FROM customers WHERE cus_id = ?`,
      [cid]
    );

    if (cusRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบลูกค้าในระบบ" });
    }

    // 🔎 validate travel_id
    const safeTravelId = Number(travel_id);

    if (safeTravelId <= 0) {
      return res.status(400).json({
        message: "travel_id ไม่ถูกต้อง",
      });
    }

    // 💾 INSERT (ตรง DB ใหม่)
    const [result]: any = await db.query(
      `
      INSERT INTO booking_queues (
        ref_guid_id,
        ref_cus_id,
        ref_travel_id,
        booking_start_date,
        booking_end_date,
        booking_cus_amount,
        booking_total_price,
        booking_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        gid,
        cid,
        safeTravelId,
        start_date,
        end_date,
        people,
        total_price,
        status,
      ]
    );

    return res.status(201).json({
      message: "จองสำเร็จ",
      booking_queue_id: result.insertId,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: "Server Error",
      error: err.message,
    });
  }
});

export default router;

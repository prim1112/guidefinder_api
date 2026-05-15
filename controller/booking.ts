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
    location_travel_id,
    people,
    start_date,
    end_date,
    total_price,
    status,
  } = req.body;

  try {
    // CHECK INPUT
    if (
      gid == null ||
      cid == null ||
      location_travel_id == null ||
      people == null ||
      !start_date ||
      !end_date ||
      total_price == null ||
      status == null
    ) {
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    // CHECK GUIDE
    const [guideRows]: any = await db.query(
      `SELECT guides_id FROM guides WHERE guides_id = ?`,
      [gid],
    );

    if (guideRows.length === 0) {
      return res.status(400).json({
        message: "ไม่พบไกด์ในระบบ",
      });
    }

    // CHECK CUSTOMER
    const [cusRows]: any = await db.query(
      `SELECT cus_id FROM customers WHERE cus_id = ?`,
      [cid],
    );

    if (cusRows.length === 0) {
      return res.status(400).json({
        message: "ไม่พบลูกค้าในระบบ",
      });
    }

    // CHECK LOCATION TRAVEL
    const [locRows]: any = await db.query(
      `SELECT location_travel_id FROM location_travel WHERE location_travel_id = ?`,
      [location_travel_id],
    );

    if (locRows.length === 0) {
      return res.status(400).json({
        message: "ไม่พบสถานที่ท่องเที่ยวในระบบ",
      });
    }

    // =========================
    // INSERT BOOKING
    // =========================
    const [result]: any = await db.query(
      `
      INSERT INTO booking_queues (
        ref_guid_id,
        ref_cus_id,
        ref_locid,
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
        location_travel_id,
        start_date,
        end_date,
        people,
        total_price,
        status,
      ],
    );

    return res.status(201).json({
      message: "เพิ่มข้อมูลลงคิวการจองสำเร็จ",
      booking_queue_id: result.insertId,
    });
  } catch (error: any) {
    console.error("BOOKING ERROR:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;

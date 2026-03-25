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
    // required fields
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
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    const checkExist = async (sql: string, value: any) => {
      const [rows]: any = await db.query(sql, [value]);
      return rows.length > 0;
    };

    if (!(await checkExist("SELECT gid FROM guide WHERE gid = ?", gid))) {
      return res.status(400).json({ message: "ไม่พบ gid ในระบบ guide" });
    }

    if (!(await checkExist("SELECT cid FROM customer WHERE cid = ?", cid))) {
      return res.status(400).json({ message: "ไม่พบ cid ในระบบ customer" });
    }

    if (
      !(await checkExist(
        "SELECT location_id FROM location WHERE location_id = ?",
        location_id
      ))
    ) {
      return res
        .status(400)
        .json({ message: "ไม่พบ location_id ในระบบ location" });
    }

    // insert booking database 
    const [result]: any = await db.query(
      `INSERT INTO booking 
      (gid, cid, location_id, people, start_date, end_date, status, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [gid, cid, location_id, people, start_date, end_date, status, total_price]
    );

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
  } catch (error: any) {
    console.error("POST /booking error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;
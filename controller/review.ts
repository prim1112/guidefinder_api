import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";

export const router = Router();


// POST REVIEW GUIDE
router.post("/guide", async (req: Request, res: Response) => {
  try {
    const { booking_queue_id, guide_star, guide_comment } = req.body;

    if (!booking_queue_id || !guide_star) {
      return res.status(400).json({
        success: false,
        message: "ข้อมูลไม่ครบ (guide)",
      });
    }

    await db.query(
      `INSERT INTO review_guides 
       (booking_queue_id, guide_star, guide_comment)
       VALUES (?, ?, ?)`,
      [booking_queue_id, guide_star, guide_comment]
    );

    return res.json({
      success: true,
      message: "รีวิวไกด์สำเร็จ",
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ของระบบไกด์" 
    });
  }
});


//  POST REVIEW PLACE
 router.post("/place", async (req: Request, res: Response) => {
  try {
    const { booking_queue_id, place_star, place_comment } = req.body;

    if (!booking_queue_id || !place_star) {
      return res.status(400).json({
        success: false,
        message: "ข้อมูลไม่ครบ (place)",
      });
    }

    // อัปเดตคอลัมน์และตารางตามสเปกจริงของ MySQL
    await db.query(
      `INSERT INTO review_locations 
       (booking_queue_id, location_star, location_comment)
       VALUES (?, ?, ?)`,
      [booking_queue_id, place_star, place_comment]
    );

    return res.json({
      success: true,
      message: "รีวิวสถานที่สำเร็จ",
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ของระบบสถานที่" 
    });
  }
});



// GET REVIEWS BY GUIDE
router.get("/guide/:guide_id", async (req: Request, res: Response) => {
  try {
    const { guide_id } = req.params;

    const [rows] = await db.query(
      `
      SELECT rg.*
      FROM review_guides rg
      JOIN booking_queue b 
        ON rg.booking_queue_id = b.booking_queue_id
      WHERE b.guide_id = ?
      `,
      [guide_id]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
});



// GET REVIEWS BY PLACE

router.get("/place/:place_id", async (req: Request, res: Response) => {
  try {
    const { place_id } = req.params;

    const [rows] = await db.query(
      `
      SELECT rp.*
      FROM review_places rp
      JOIN booking_queue b 
        ON rp.booking_queue_id = b.booking_queue_id
      WHERE b.ref_travel_id = ?  -- ✨ แก้ตรงนี้จาก b.place_id เป็น b.ref_travel_id ให้ตรงกับตาราง DB
      `,
      [place_id]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
});

export default router;
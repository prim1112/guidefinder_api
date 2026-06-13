import { Request, Response, Router } from "express";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();

const provinceTH: { [key: string]: string } = {
  Bangkok: "กรุงเทพมหานคร",
  "Amnat Charoen": "อำนาจเจริญ",
  "Ang Thong": "อ่างทอง",
  "Bueng Kan": "บึงกาฬ",
  "Buri Ram": "บุรีรัมย์",
  Chachoengsao: "ฉะเชิงเทรา",
  "Chai Nat": "ชัยนาท",
  Chaiyaphum: "ชัยภูมิ",
  Chanthaburi: "จันทบุรี",
  "Chiang Mai": "เชียงใหม่",
  "Chiang Rai": "เชียงราย",
  "Chon Buri": "ชลบุรี",
  Chumphon: "ชุมพร",
  Kalasin: "กาฬสินธุ์",
  "Kamphaeng Phet": "กำแพงเพชร",
  Kanchanaburi: "กาญจนบุรี",
  "Khon Kaen": "ขอนแก่น",
  Krabi: "กระบี่",
  Lampang: "ลำปาง",
  Lamphun: "ลำพูน",
  Loei: "เลย",
  "Lop Buri": "ลพบุรี",
  "Mae Hong Son": "แม่ฮ่องสอน",
  "Maha Sarakham": "มหาสารคาม",
  Mukdahan: "มุกดาหาร",
  "Nakhon Nayok": "นครนายก",
  "Nakhon Pathom": "นครปฐม",
  "Nakhon Phanom": "นครพนม",
  "Nakhon Ratchasima": "นครราชสีมา",
  "Nakhon Sawan": "นครสวรรค์",
  "Nakhon Si Thammarat": "นครศรีธรรมราช",
  Nan: "น่าน",
  Narathiwat: "นราธิวาส",
  "Nong Bua Lam Phu": "หนองบัวลำภู",
  "Nong Khai": "หนองคาย",
  Nonthaburi: "นนทบุรี",
  "Pathum Thani": "ปทุมธานี",
  Pattani: "ปัตตานี",
  Phangnga: "พังงา",
  Phatthalung: "พัทลุง",
  Phayao: "พะเยา",
  Phetchabun: "เพชรบูรณ์",
  Phetchaburi: "เพชรบุรี",
  Phichit: "พิจิตร",
  Phitsanulok: "พิษณุโลก",
  "Phra Nakhon Si Ayutthaya": "พระนครศรีอยุธยา",
  Phrae: "แพร่",
  Phuket: "ภูเก็ต",
  "Prachin Buri": "ปราจีนบุรี",
  "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  Ranong: "ระนอง",
  Ratchaburi: "ราชบุรี",
  Rayong: "ระยอง",
  "Roi Et": "ร้อยเอ็ด",
  "Sa Kaeo": "สระแก้ว",
  "Sakon Nakhon": "สกลนคร",
  "Samut Prakan": "สมุทรปราการ",
  "Samut Sakhon": "สมุทรสาคร",
  "Samut Songkhram": "สมุทรสงคราม",
  Saraburi: "สระบุรี",
  Satun: "สตูล",
  "Sing Buri": "สิงห์บุรี",
  "Si Sa Ket": "ศรีสะเกษ",
  Songkhla: "สงขลา",
  Sukhothai: "สุโขทัย",
  "Suphan Buri": "สุพรรณบุรี",
  "Surat Thani": "สุราษฎร์ธานี",
  Surin: "สุรินทร์",
  Tak: "ตาก",
  Trang: "ตรัง",
  Trat: "ตราด",
  "Ubon Ratchathani": "อุบลราชธานี",
  "Udon Thani": "อุดรธานี",
  "Uthai Thani": "อุทัยธานี",
  Uttaradit: "อุตรดิตถ์",
  Yala: "ยะลา",
  Yasothon: "ยโสธร",
};

const toThaiProvince = (en: string) => provinceTH[en] || en;

// GET ALL BOOKING
router.get("/booking", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM booking_queues");
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

// CREATE BOOKING (เวอร์ชันแก้ไข ป้องกันข้อมูลซ้ำ)
router.post("/booking", async (req: Request, res: Response) => {
  console.log(req.body);
  const { gid, cid, travel_id, people, start_date, end_date, total_price } = req.body;

  try {
    await db.query("START TRANSACTION");

    if (
      gid === undefined ||
      cid === undefined ||
      travel_id === undefined ||
      people === undefined ||
      !start_date ||
      !end_date ||
      total_price === undefined
    ) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const [guideRows]: any = await db.query(`SELECT guides_id FROM guides WHERE guides_id = ?`, [gid]);
    if (guideRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "ไม่พบไกด์" });
    }

    const [cusRows]: any = await db.query(`SELECT cus_id FROM customers WHERE cus_id = ?`, [cid]);
    if (cusRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "ไม่พบลูกค้า" });
    }

    const [travelRows]: any = await db.query(`SELECT id FROM location_travel WHERE location_id = ?`, [travel_id]);
    if (travelRows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "ไม่พบสถานที่" });
    }

    const refTravelId = travelRows[0].id;
    const start = new Date(start_date);
    const end = new Date(end_date);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // 1. เช็คว่าไกด์ว่างไหมในช่วงเวลานั้น (มีอยู่เดิม)
    const [duplicate]: any = await db.query(
      `
      SELECT 1
      FROM booking_queues
      WHERE ref_guid_id = ?
      AND booking_status IN (0, 1, 3)
      AND NOT (
        booking_end_date < ?
        OR booking_start_date > ?
      )
      LIMIT 1
      `,
      [gid, start, end]
    );

    if (duplicate.length > 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "ช่วงเวลานี้ไกด์ไม่ว่าง" });
    }

    // ✨ 2. เพิ่มเติม: เช็คว่าลูกค้ารายนี้เคยส่งคำขอจอง "ทริปเดียวกัน วันเดียวกัน" ไปแล้วหรือยัง (ป้องกันการกดเบิ้ล)
    const [customerDuplicate]: any = await db.query(
      `
      SELECT 1 
      FROM booking_queues 
      WHERE ref_cus_id = ? 
      AND ref_guid_id = ? 
      AND ref_travel_id = ?
      AND booking_start_date = ? 
      AND booking_status = 0
      LIMIT 1
      `,
      [cid, gid, refTravelId, start]
    );

    if (customerDuplicate.length > 0) {
      await db.query("ROLLBACK");
      return res.status(400).json({ message: "คุณได้ส่งคำขอจองรายการนี้ไปแล้ว อยู่ระหว่างรอไกด์ยืนยัน" });
    }

    // ทำการบันทึกข้อมูลเมื่อผ่านการตรวจสอบทั้งหมด
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
      [gid, cid, refTravelId, start, end, people, total_price, 0]
    );

    await db.query("COMMIT");
    return res.status(201).json({
      message: "จองสำเร็จ",
      booking_queue_id: result.insertId,
    });
  } catch (error: any) {
    await db.query("ROLLBACK");
    console.log(error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// GET UNAVAILABLE DATE
router.get("/booking/unavailable/:gid", async (req: Request, res: Response) => {
  const gid = Number(req.params.gid);
  try {
    const [rows]: any = await db.query(
      `
      SELECT booking_start_date, booking_end_date, booking_status
      FROM booking_queues
      WHERE ref_guid_id = ?
      AND booking_status IN (0, 1, 3)
      `,
      [gid],
    );
    return res.status(200).json({
      message: "ดึงวันไม่ว่างสำเร็จ",
      data: rows,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// CUSTOMER BOOKING
router.get("/booking/customer/:id", async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const [rows]: any = await db.query(
      `
      SELECT 
        b.booking_queue_id, b.booking_start_date, b.booking_end_date,
        b.booking_status, b.booking_total_price, b.booking_cus_amount,
        l.travel_name, l.travel_detail, l.travel_image, loc.location_province
      FROM booking_queues b
      LEFT JOIN location_travel l ON b.ref_travel_id = l.id
      LEFT JOIN location loc ON l.location_id = loc.location_id
      WHERE b.ref_cus_id = ?
      ORDER BY b.booking_queue_id DESC
      `,
      [customerId],
    );

    const result = rows.map((b: any) => ({
      ...b,
      location_province: toThaiProvince(b.location_province),
    }));

    return res.status(200).json({
      message: "ดึงข้อมูลการจองของลูกค้าสำเร็จ",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// GUIDE BOOKING
router.get("/booking/guide/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  // ตรวจสอบเบื้องต้นว่ามี gid ส่งมาหรือไม่
  if (!gid) {
    return res.status(400).json({
      message: "กรุณาระบุรหัสไกด์ (gid)",
    });
  }

  try {
    // ดึงข้อมูลโดยเอาเงื่อนไขคอมเมนต์เดิมออกเรียบร้อยแล้ว เพื่อให้สถานะ 0, 1, 2, 3, 4 ออกมาครบถ้วน
    const [bookings]: any = await db.query(
      `
      SELECT 
        b.booking_queue_id, 
        b.booking_start_date, 
        b.booking_end_date,
        b.booking_status, 
        b.booking_total_price, 
        b.booking_cus_amount AS booking_amount_customer,
        l.travel_name, 
        l.travel_detail, 
        l.travel_image, 
        loc.location_province,
        c.cus_name, 
        c.cus_email, 
        c.cus_phonenumber
      FROM booking_queues b
      LEFT JOIN location_travel l ON b.ref_travel_id = l.id
      LEFT JOIN location loc ON l.location_id = loc.location_id
      LEFT JOIN customers c ON b.ref_cus_id = c.cus_id
      WHERE b.ref_guid_id = ? 
      ORDER BY b.booking_queue_id DESC
      `,
      [gid]
    );

    // ป้องกันกรณีที่ bookings คืนค่ากลับมาเป็น null หรือ undefined
    const safeBookings = bookings || [];

    // แปลงชื่อจังหวัดเป็นภาษาไทย
    const result = safeBookings.map((b: any) => ({
      ...b,
      location_province: typeof toThaiProvince === 'function' ? toThaiProvince(b.location_province) : b.location_province,
    }));

    return res.status(200).json({
      message: "ดึงข้อมูลการจองของไกด์สำเร็จ",
      data: result,
    });

  } catch (error: any) {
    // พิมพ์ Error ลง Console ของ Server เพื่อให้ง่ายต่อการ Debug 
    console.error("GET GUIDE BOOKING ERROR =>", error);
    
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดภายในระบบ (Server Error)",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// BOOKING DETAIL
router.get("/booking/detail/:booking_id", async (req: Request, res: Response) => {
  const booking_id = req.params.booking_id;
  try {
    const [rows]: any = await db.query(
      `
      SELECT 
        b.booking_queue_id, b.booking_start_date, b.booking_end_date,
        b.booking_status, b.booking_total_price, b.booking_cus_amount,
        l.travel_name, l.travel_detail, l.travel_image, loc.location_province,
        g.guides_name, g.guides_language, g.guides_email, g.guides_facebook, g.guides_phonenumber
      FROM booking_queues b
      LEFT JOIN location_travel l ON b.ref_travel_id = l.id
      LEFT JOIN location loc ON l.location_id = loc.location_id
      LEFT JOIN guides g ON b.ref_guid_id = g.guides_id
      WHERE b.booking_queue_id = ?
      `,
      [booking_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลการจอง" });
    }

    const booking = {
      ...rows[0],
      location_province: toThaiProvince(rows[0].location_province),
    };

    return res.json({
      message: "ดึงรายละเอียดการจองสำเร็จ",
      data: booking,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// CANCEL BOOKING (ลูกค้ากดยกเลิก)
router.patch("/booking/cancel/:bid", async (req, res) => {
  const bid = req.params.bid;
  try {
    const [rows]: any = await db.query(
      `SELECT booking_status, booking_start_date FROM booking_queues WHERE booking_queue_id = ?`,
      [bid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบรายการจอง" });
    }

    const booking = rows[0];
    const currentStatus = Number(booking.booking_status);

    if (currentStatus === 2) {
      return res.status(400).json({ message: "รายการนี้ถูกยกเลิกไปแล้ว" });
    }

    if (currentStatus >= 3) {
      return res.status(400).json({ message: "ไม่สามารถยกเลิกได้ เนื่องจากทริปเริ่มต้นหรือจบไปแล้ว" });
    }

    if (currentStatus === 1) {
      const tripDate = new Date(booking.booking_start_date);
      const now = new Date();
      tripDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      const diffDays = (tripDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 3) {
        return res.status(400).json({
          message: "ต้องยกเลิกก่อนวันเดินทางอย่างน้อย 3 วัน (เมื่อไกด์รับงานแล้ว)",
        });
      }
    }

    await db.query(`UPDATE booking_queues SET booking_status = 2 WHERE booking_queue_id = ?`, [bid]);
    return res.status(200).json({ message: "ยกเลิกการจองสำเร็จ" });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// GUIDE CANCEL BOOKING (ไกด์กดยกเลิก)
router.patch("/booking/guide/cancel/:bid", async (req, res) => {
  const bid = req.params.bid;
  try {
    const [rows]: any = await db.query(
      `SELECT booking_status FROM booking_queues WHERE booking_queue_id = ?`,
      [bid],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูล" });
    }

    const status = rows[0].booking_status;
    if (status >= 3) {
      return res.status(400).json({ message: "ไม่สามารถยกเลิกได้เนื่องจากทริปดำเนินอยู่หรือจบลงแล้ว" });
    }

    await db.query(`UPDATE booking_queues SET booking_status = 2 WHERE booking_queue_id = ?`, [bid]);
    return res.json({ message: "ไกด์ยกเลิกงานสำเร็จ" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// ACCEPT BOOKING (ไกด์กดรับงาน)
router.patch("/booking/accept/:bid", async (req: Request, res: Response) => {
  const bid = req.params.bid;
  try {
    const [result]: any = await db.query(
      `UPDATE booking_queues SET booking_status = 1 WHERE booking_queue_id = ? AND booking_status = 0`,
      [bid]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "ไม่สามารถรับงานได้ เนื่องจากสถานะจองเปลี่ยนไปหรือถูกยกเลิกแล้ว" });
    }

    return res.json({ message: "รับงานสำเร็จ" });
  } catch (error: any) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// START BOOKING (เริ่มทริป)
router.patch("/booking/start/:bid", async (req: Request, res: Response) => {
  const bid = req.params.bid;
  try {
    const [rows]: any = await db.query(
      `SELECT booking_status FROM booking_queues WHERE booking_queue_id = ?`,
      [bid],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบรายการจอง" });
    }

    const booking = rows[0];
    if (Number(booking.booking_status) !== 1) {
      return res.status(400).json({ message: "ยังเริ่มทริปไม่ได้ (ไกด์ต้องกดรับงานก่อน)" });
    }

    await db.query(`UPDATE booking_queues SET booking_status = 3 WHERE booking_queue_id = ?`, [bid]);
    return res.json({ message: "เริ่มทริปแล้ว" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// FINISH BOOKING (จบทริป) - เวอร์ชันอัปเดตฟิลด์แจ้งเตือน (is_read = 0)
router.patch("/booking/finish/:bid", async (req: Request, res: Response) => {
  const bid = req.params.bid;
  const io = req.app.get("io");

  try {
    const [bookingDetails]: any = await db.query(
      `
      SELECT b.ref_cus_id AS tourist_id, b.booking_status, lt.travel_name AS attraction_name 
      FROM booking_queues b
      INNER JOIN location_travel lt ON b.ref_travel_id = lt.id
      WHERE b.booking_queue_id = ?
      `,
      [bid],
    );

    if (bookingDetails.length === 0) {
      return res.status(404).json({ message: "ไม่พบรายการจอง" });
    }

    const { tourist_id, booking_status, attraction_name } = bookingDetails[0];

    if (booking_status !== 3) {
      let statusText = "อยู่ในสถานะที่ไม่สามารถจบงานได้";
      if (booking_status === 1) statusText = "ทริปนี้ยังไม่ได้เริ่มเดินทาง (ยังไม่ได้กดเริ่มทริป)";
      if (booking_status === 4) statusText = "ทริปนี้ถูกปิดงาน/จบงานไปก่อนหน้านี้แล้ว";
      if (booking_status === 2) statusText = "ทริปนี้ถูกยกเลิกไปแล้ว";

      return res.status(400).json({
        message: `ไม่สามารถจบงานได้: ${statusText}`,
        current_status: booking_status
      });
    }

    // 🪄 จุดที่แก้ไข: เพิ่มการ SET is_read = 0 เข้าไปใน Query ตอนที่ปรับสถานะเป็นจบทริป (booking_status = 4)
    const [result]: any = await db.query(
      `UPDATE booking_queues 
       SET booking_status = 4, is_read = 0 
       WHERE booking_queue_id = ? AND booking_status = 3`,
      [bid],
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "ไม่สามารถอัปเดตสถานะได้ เนื่องจากข้อมูลมีการเปลี่ยนแปลง" });
    }

    if (io) {
      io.to(tourist_id.toString()).emit("job_finished_notification", {
        booking_queue_id: bid,
        title: "การบริการเรียบร้อย",
        message: `หากคุณพอใจ รบกวนช่วยให้คะแนนรีวิว\n${attraction_name || "สถานที่ท่องเที่ยว"}`,
      });
    }

    return res.json({ message: "จบงานสำเร็จ" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// CUSTOMER HISTORY (ประวัติที่สำเร็จแล้ว)
router.get("/history/customer/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [rows]: any = await db.query(
      `
      SELECT 
        b.booking_queue_id, b.booking_status, b.booking_start_date, b.booking_end_date, b.booking_total_price,
        l.travel_name, l.travel_detail, l.travel_image,
        CASE WHEN rl.booking_queue_id IS NOT NULL THEN 1 ELSE 0 END AS reviewed_place,
        CASE WHEN rg.booking_queue_id IS NOT NULL THEN 1 ELSE 0 END AS reviewed_guide
      FROM booking_queues b
      LEFT JOIN location_travel l ON b.ref_travel_id = l.id
      LEFT JOIN review_locations rl ON b.booking_queue_id = rl.booking_queue_id
      LEFT JOIN review_guides rg ON b.booking_queue_id = rg.booking_queue_id
      WHERE b.ref_cus_id = ? AND b.booking_status = 4
      ORDER BY b.booking_queue_id DESC
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "ดึงประวัติสำเร็จ",
      data: rows,
    });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

router.get("/notification/unread/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await db.query(
      `SELECT COUNT(*) as count FROM booking_queues WHERE ref_cus_id = ? AND booking_status = 4 AND is_read = 0`,
      [id]
    );
    return res.json({ unread: rows[0].count });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.patch("/notification/read/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await db.query(`UPDATE booking_queues SET is_read = 1 WHERE ref_cus_id = ? AND booking_status = 4`, [id]);
    return res.json({ message: "marked as read" });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
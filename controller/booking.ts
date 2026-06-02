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

/* ================= GET ALL BOOKING ================= */
router.get("/booking", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM booking_queues");

    return res.json({
      message: "ดึงข้อมูล Booking สำเร็จ",
      data: rows,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

/* ================= CREATE BOOKING (FINAL) ================= */
router.post("/booking", async (req: Request, res: Response) => {
  const { gid, cid, travel_id, people, start_date, end_date, total_price } =
    req.body;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // validate
    if (!gid || !cid || !travel_id || !people || !start_date || !end_date) {
      await conn.rollback();
      return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ" });
    }

    // check guide
    const [guide]: any = await conn.query(
      `SELECT guides_id FROM guides WHERE guides_id = ?`,
      [gid]
    );
    if (!guide.length) {
      await conn.rollback();
      return res.status(400).json({ message: "ไม่พบไกด์" });
    }

    // check customer
    const [cus]: any = await conn.query(
      `SELECT cus_id FROM customers WHERE cus_id = ?`,
      [cid]
    );
    if (!cus.length) {
      await conn.rollback();
      return res.status(400).json({ message: "ไม่พบลูกค้า" });
    }

    // travel map
    const [travel]: any = await conn.query(
      `SELECT id FROM location_travel WHERE location_id = ?`,
      [travel_id]
    );

    if (!travel.length) {
      await conn.rollback();
      return res.status(400).json({ message: "ไม่พบสถานที่" });
    }

    const refTravelId = travel[0].id;

    const start = new Date(start_date);
    const end = new Date(end_date);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // overlap check
    const [dup]: any = await conn.query(
      `
      SELECT 1 FROM booking_queues
      WHERE ref_guid_id = ?
      AND booking_status IN (2,3)
      AND NOT (booking_end_date < ? OR booking_start_date > ?)
      LIMIT 1
      `,
      [gid, start, end]
    );

    if (dup.length) {
      await conn.rollback();
      return res.status(400).json({ message: "ไกด์ไม่ว่างในช่วงนี้" });
    }

    // insert
    const [result]: any = await conn.query(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [gid, cid, refTravelId, start, end, people, total_price]
    );

    await conn.commit();

    return res.status(201).json({
      message: "จองสำเร็จ",
      booking_queue_id: result.insertId,
    });
  } catch (err: any) {
    await conn.rollback();
    return res.status(500).json({ message: err.message });
  }
});

/* ================= ACCEPT BOOKING ================= */
router.patch("/booking/accept/:bid", async (req, res) => {
  const { bid } = req.params;

  await db.query(
    `UPDATE booking_queues SET booking_status = 2 WHERE booking_queue_id = ?`,
    [bid]
  );

  return res.json({ message: "รับงานสำเร็จ" });
});

/* ================= START BOOKING ================= */
router.patch("/booking/start/:bid", async (req, res) => {
  const { bid } = req.params;

  const [rows]: any = await db.query(
    `SELECT booking_status FROM booking_queues WHERE booking_queue_id = ?`,
    [bid]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "ไม่พบรายการจอง" });
  }

  if (Number(rows[0].booking_status) !== 2) {
    return res.status(400).json({ message: "ต้องรับงานก่อน" });
  }

  await db.query(
    `UPDATE booking_queues SET booking_status = 3 WHERE booking_queue_id = ?`,
    [bid]
  );

  return res.json({ message: "เริ่มทริปแล้ว" });
});

/* ================= FINISH BOOKING ================= */
router.patch("/booking/finish/:bid", async (req: Request, res: Response) => {
  const { bid } = req.params;
  const io = req.app.get("io");

  try {
    const [rows]: any = await db.query(
      `
      SELECT 
        b.booking_status,
        b.ref_cus_id AS tourist_id,
        lt.travel_name
      FROM booking_queues b
      JOIN location_travel lt ON b.ref_travel_id = lt.id
      WHERE b.booking_queue_id = ?
      `,
      [bid]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "ไม่พบรายการจอง" });
    }

    const booking = rows[0];

    if (Number(booking.booking_status) !== 3) {
      return res.status(400).json({
        message: "ต้องอยู่สถานะกำลังเริ่มทริป",
      });
    }

    await db.query(
      `UPDATE booking_queues SET booking_status = 4 WHERE booking_queue_id = ?`,
      [bid]
    );

    if (io) {
      io.to(booking.tourist_id.toString()).emit("job_finished_notification", {
        booking_queue_id: bid,
        title: "จบทริปแล้ว",
        message: `ช่วยรีวิว: ${booking.travel_name}`,
      });
    }

    return res.json({ message: "จบทริปสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

/* ================= CANCEL BOOKING ================= */
router.patch("/booking/cancel/:bid", async (req, res) => {
  const { bid } = req.params;

  const [rows]: any = await db.query(
    `SELECT booking_status FROM booking_queues WHERE booking_queue_id = ?`,
    [bid]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "ไม่พบรายการจอง" });
  }

  const status = Number(rows[0].booking_status);

  if (status >= 3) {
    return res.status(400).json({
      message: "ยกเลิกไม่ได้ (เริ่มหรือจบแล้ว)",
    });
  }

  await db.query(
    `UPDATE booking_queues SET booking_status = 5 WHERE booking_queue_id = ?`,
    [bid]
  );

  return res.json({ message: "ยกเลิกสำเร็จ" });
});

/* ================= CUSTOMER BOOKING ================= */
router.get("/booking/customer/:id", async (req, res) => {
  const { id } = req.params;

  const [rows]: any = await db.query(
    `
    SELECT b.*, l.travel_name, l.travel_image, loc.location_province
    FROM booking_queues b
    LEFT JOIN location_travel l ON b.ref_travel_id = l.id
    LEFT JOIN location loc ON l.location_id = loc.location_id
    WHERE b.ref_cus_id = ?
    ORDER BY b.booking_queue_id DESC
    `,
    [id]
  );

  const result = rows.map((b: any) => ({
    ...b,
    location_province: toThaiProvince(b.location_province),
  }));

  return res.json({ data: result });
});

/* ================= GUIDE BOOKING ================= */
router.get("/booking/guide/:gid", async (req, res) => {
  const { gid } = req.params;

  const [rows]: any = await db.query(
    `
    SELECT b.*, l.travel_name, c.cus_name
    FROM booking_queues b
    LEFT JOIN location_travel l ON b.ref_travel_id = l.id
    LEFT JOIN customers c ON b.ref_cus_id = c.cus_id
    WHERE b.ref_guid_id = ?
    ORDER BY b.booking_queue_id DESC
    `,
    [gid]
  );

  return res.json({ data: rows });
});

/* ================= DETAIL ================= */
router.get("/booking/detail/:id", async (req, res) => {
  const { id } = req.params;

  const [rows]: any = await db.query(
    `
    SELECT b.*, l.travel_name, g.guides_name
    FROM booking_queues b
    LEFT JOIN location_travel l ON b.ref_travel_id = l.id
    LEFT JOIN guides g ON b.ref_guid_id = g.guides_id
    WHERE b.booking_queue_id = ?
    `,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "ไม่พบข้อมูล" });
  }

  return res.json({ data: rows[0] });
});

/* ================= HISTORY ================= */
router.get("/history/customer/:id", async (req, res) => {
  const { id } = req.params;

  const [rows]: any = await db.query(
    `
    SELECT *
    FROM booking_queues
    WHERE ref_cus_id = ? AND booking_status = 4
    ORDER BY booking_queue_id DESC
    `,
    [id]
  );

  return res.json({ data: rows });
});

export default router;
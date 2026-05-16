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
    travel_id,
    people,
    start_date,
    end_date,
    total_price,
    status,
  } = req.body;

  try {
    // ✅ validate แบบชัดเจน
    if (
      !gid ||
      !cid ||
      !travel_id ||
      !people ||
      !start_date ||
      !end_date ||
      !total_price ||
      status === undefined
    ) {
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    const safeTravelId = Number(travel_id);
    const safePeople = Number(people);
    const safePrice = Number(total_price);

    // ✅ check guide (ปลอดภัย)
    const [guideRows]: any = await db.query(
      `SELECT guides_id FROM guides WHERE guides_id = ?`,
      [gid]
    );

    if (guideRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบไกด์ในระบบ" });
    }

    // ✅ check customer
    const [cusRows]: any = await db.query(
      `SELECT cus_id FROM customers WHERE cus_id = ?`,
      [cid]
    );

    if (cusRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบลูกค้าในระบบ" });
    }

    // ✅ FIX: check travel จริงใน table location_travel
    const [locRows]: any = await db.query(
      `SELECT location_id FROM location_travel WHERE location_id = ?`,
      [safeTravelId]
    );

    if (locRows.length === 0) {
      return res.status(400).json({
        message: "ไม่พบสถานที่ในระบบ",
      });
    }

    // ✅ insert booking
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
        safePeople,
        safePrice,
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

router.get("/booking/customer/:cid", async (req: Request, res: Response) => {
  const cid = req.params.cid;

  try {
    const [bookings]: any = await db.query(
      `SELECT 
        b.booking_queue_id,
        b.booking_start_date,
        b.booking_end_date,
        b.booking_status,
        b.booking_total_price,

        l.travel_name,
        l.travel_detail,
        l.travel_image,

        loc.location_province

      FROM booking_queues b

      LEFT JOIN location_travel l 
        ON b.ref_travel_id = l.location_id

      LEFT JOIN location loc
        ON l.location_id = loc.location_id

      WHERE b.ref_cus_id = ?

      ORDER BY b.booking_queue_id DESC`,
      [cid]
    );

    // ✅ FIX สำคัญ: ต้อง map แปลงจังหวัด
    const result = bookings.map((b: any) => ({
      ...b,
      location_province: toThaiProvince(b.location_province),
    }));

    return res.json({
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

router.get("/booking/detail/:booking_id", async (req: Request, res: Response) => {
  const booking_id = req.params.booking_id;

  try {
    const [rows]: any = await db.query(
      `SELECT 
        b.booking_queue_id,
        b.booking_start_date,
        b.booking_end_date,
        b.booking_status,
        b.booking_total_price,
        b.booking_people,

        -- สถานที่
        l.travel_name,
        l.travel_detail,
        l.travel_image,

        -- จังหวัด
        loc.location_province,

        -- ข้อมูลไกด์
        g.guide_name,
        g.guide_language,
        g.guide_email,
        g.guide_facebook,
        g.guide_phone

      FROM booking_queues b

      LEFT JOIN location_travel l
        ON b.ref_travel_id = l.location_id

      LEFT JOIN location loc
        ON l.location_id = loc.location_id

      LEFT JOIN guides g
        ON b.ref_guid_id = g.guide_id

      WHERE b.booking_queue_id = ?`,
      [booking_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลการจอง",
      });
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

router.patch("/booking/cancel/:bid", async (req: Request, res: Response) => {
  const bid = req.params.bid; // Booking ID
  // แนะนำให้รับ user_id จาก token/session เพื่อเช็คความเป็นเจ้าของด้วย

  try {
    // 1. ตรวจสอบสถานะก่อนว่ายกเลิกได้ไหม (เช่น ถ้าจ่ายเงินแล้วอาจห้ามยกเลิก)
    const [booking]: any = await db.query(
      "SELECT booking_status FROM booking_queues WHERE booking_queue_id = ?",
      [bid]
    );

    if (booking.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลการจอง" });
    }

    if (booking[0].booking_status === 'cancelled') {
      return res.status(400).json({ message: "รายการนี้ถูกยกเลิกไปแล้ว" });
    }

    // 2. อัปเดตสถานะเป็น 'cancelled'
    await db.query(
      "UPDATE booking_queues SET booking_status = 'cancelled' WHERE booking_queue_id = ?",
      [bid]
    );

    return res.json({
      message: "ยกเลิกการจองเรียบร้อยแล้ว",
    });

  } catch (error: any) {
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการยกเลิก",
      error: error.message,
    });
  }
}); 

export default router;

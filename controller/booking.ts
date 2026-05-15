import { Request, Response, Router } from "express";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();

const provinceTH: Record<string, string> = {
  Bangkok: "กรุงเทพมหานคร",
  AmnatCharoen: "อำนาจเจริญ",
  AngThong: "อ่างทอง",
  BuengKan: "บึงกาฬ",
  BuriRam: "บุรีรัมย์",
  Chachoengsao: "ฉะเชิงเทรา",
  ChaiNat: "ชัยนาท",
  Chaiyaphum: "ชัยภูมิ",
  Chanthaburi: "จันทบุรี",
  ChiangMai: "เชียงใหม่",
  ChiangRai: "เชียงราย",
  ChonBuri: "ชลบุรี",
  Chumphon: "ชุมพร",
  Kalasin: "กาฬสินธุ์",
  KamphaengPhet: "กำแพงเพชร",
  Kanchanaburi: "กาญจนบุรี",
  KhonKaen: "ขอนแก่น",
  Krabi: "กระบี่",
  Lampang: "ลำปาง",
  Lamphun: "ลำพูน",
  Loei: "เลย",
  LopBuri: "ลพบุรี",
  MaeHongSon: "แม่ฮ่องสอน",
  MahaSarakham: "มหาสารคาม",
  Mukdahan: "มุกดาหาร",
  NakhonNayok: "นครนายก",
  NakhonPathom: "นครปฐม",
  NakhonPhanom: "นครพนม",
  NakhonRatchasima: "นครราชสีมา",
  NakhonSawan: "นครสวรรค์",
  NakhonSiThammarat: "นครศรีธรรมราช",
  Nan: "น่าน",
  Narathiwat: "นราธิวาส",
  NongBuaLamPhu: "หนองบัวลำภู",
  NongKhai: "หนองคาย",
  Nonthaburi: "นนทบุรี",
  PathumThani: "ปทุมธานี",
  Pattani: "ปัตตานี",
  PhangNga: "พังงา",
  Phatthalung: "พัทลุง",
  Phayao: "พะเยา",
  Phetchabun: "เพชรบูรณ์",
  Phetchaburi: "เพชรบุรี",
  Phichit: "พิจิตร",
  Phitsanulok: "พิษณุโลก",
  PhraNakhonSiAyutthaya: "พระนครศรีอยุธยา",
  Phrae: "แพร่",
  Phuket: "ภูเก็ต",
  PrachinBuri: "ปราจีนบุรี",
  PrachuapKhiriKhan: "ประจวบคีรีขันธ์",
  Ranong: "ระนอง",
  Ratchaburi: "ราชบุรี",
  Rayong: "ระยอง",
  RoiEt: "ร้อยเอ็ด",
  SaKaeo: "สระแก้ว",
  SakonNakhon: "สกลนคร",
  SamutPrakan: "สมุทรปราการ",
  SamutSakhon: "สมุทรสาคร",
  SamutSongkhram: "สมุทรสงคราม",
  Saraburi: "สระบุรี",
  Satun: "สตูล",
  SingBuri: "สิงห์บุรี",
  SiSaKet: "ศรีสะเกษ",
  Songkhla: "สงขลา",
  Sukhothai: "สุโขทัย",
  SuphanBuri: "สุพรรณบุรี",
  SuratThani: "สุราษฎร์ธานี",
  Surin: "สุรินทร์",
  Tak: "ตาก",
  Trang: "ตรัง",
  Trat: "ตราด",
  UbonRatchathani: "อุบลราชธานี",
  UdonThani: "อุดรธานี",
  UthaiThani: "อุทัยธานี",
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
    if (
      gid == null ||
      cid == null ||
      travel_id == null ||
      people == null ||
      start_date == null ||
      end_date == null ||
      total_price == null ||
      status == null
    ) {
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    const safeTravelId = Number(travel_id);

    // ✅ ตรวจไกด์
    const [guideRows]: any = await db.query(
      `SELECT guides_id FROM guides WHERE guides_id = ?`,
      [gid],
    );

    if (guideRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบไกด์ในระบบ" });
    }

    // ✅ ตรวจลูกค้า
    const [cusRows]: any = await db.query(
      `SELECT cus_id FROM customers WHERE cus_id = ?`,
      [cid],
    );

    if (cusRows.length === 0) {
      return res.status(400).json({ message: "ไม่พบลูกค้าในระบบ" });
    }

    // ✅ FIX ตรงนี้สำคัญมาก
    const [locRows]: any = await db.query(
      `SELECT location_id FROM location_travel WHERE location_id = ?`,
      [safeTravelId],
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
        people,
        total_price,
        status,
      ],
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

export default router;

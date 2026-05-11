import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ ฟังก์ชันอัปโหลดรูปขึ้น Cloudinary
const uploadToCloudinary = (buffer: Buffer, folder: string) =>
  new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
  const provinceTH: { [key: string]: string } = {
  "Bangkok": "กรุงเทพมหานคร",
  "Amnat Charoen": "อำนาจเจริญ",
  "Ang Thong": "อ่างทอง",
  "Bueng Kan": "บึงกาฬ",
  "Buri Ram": "บุรีรัมย์",
  "Chachoengsao": "ฉะเชิงเทรา",
  "Chai Nat": "ชัยนาท",
  "Chaiyaphum": "ชัยภูมิ",
  "Chanthaburi": "จันทบุรี",
  "Chiang Mai": "เชียงใหม่",
  "Chiang Rai": "เชียงราย",
  "Chon Buri": "ชลบุรี",
  "Chumphon": "ชุมพร",
  "Kalasin": "กาฬสินธุ์",
  "Kamphaeng Phet": "กำแพงเพชร",
  "Kanchanaburi": "กาญจนบุรี",
  "Khon Kaen": "ขอนแก่น",
  "Krabi": "กระบี่",
  "Lampang": "ลำปาง",
  "Lamphun": "ลำพูน",
  "Loei": "เลย",
  "Lop Buri": "ลพบุรี",
  "Mae Hong Son": "แม่ฮ่องสอน",
  "Maha Sarakham": "มหาสารคาม",
  "Mukdahan": "มุกดาหาร",
  "Nakhon Nayok": "นครนายก",
  "Nakhon Pathom": "นครปฐม",
  "Nakhon Phanom": "นครพนม",
  "Nakhon Ratchasima": "นครราชสีมา",
  "Nakhon Sawan": "นครสวรรค์",
  "Nakhon Si Thammarat": "นครศรีธรรมราช",
  "Nan": "น่าน",
  "Narathiwat": "นราธิวาส",
  "Nong Bua Lam Phu": "หนองบัวลำภู",
  "Nong Khai": "หนองคาย",
  "Nonthaburi": "นนทบุรี",
  "Pathum Thani": "ปทุมธานี",
  "Pattani": "ปัตตานี",
  "Phangnga": "พังงา",
  "Phatthalung": "พัทลุง",
  "Phayao": "พะเยา",
  "Phetchabun": "เพชรบูรณ์",
  "Phetchaburi": "เพชรบุรี",
  "Phichit": "พิจิตร",
  "Phitsanulok": "พิษณุโลก",
  "Phra Nakhon Si Ayutthaya": "พระนครศรีอยุธยา",
  "Phrae": "แพร่",
  "Phuket": "ภูเก็ต",
  "Prachin Buri": "ปราจีนบุรี",
  "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  "Ranong": "ระนอง",
  "Ratchaburi": "ราชบุรี",
  "Rayong": "ระยอง",
  "Roi Et": "ร้อยเอ็ด",
  "Sa Kaeo": "สระแก้ว",
  "Sakon Nakhon": "สกลนคร",
  "Samut Prakan": "สมุทรปราการ",
  "Samut Sakhon": "สมุทรสาคร",
  "Samut Songkhram": "สมุทรสงคราม",
  "Saraburi": "สระบุรี",
  "Satun": "สตูล",
  "Sing Buri": "สิงห์บุรี",
  "Si Sa Ket": "ศรีสะเกษ",
  "Songkhla": "สงขลา",
  "Sukhothai": "สุโขทัย",
  "Suphan Buri": "สุพรรณบุรี",
  "Surat Thani": "สุราษฎร์ธานี",
  "Surin": "สุรินทร์",
  "Tak": "ตาก",
  "Trang": "ตรัง",
  "Trat": "ตราด",
  "Ubon Ratchathani": "อุบลราชธานี",
  "Udon Thani": "อุดรธานี",
  "Uthai Thani": "อุทัยธานี",
  "Uttaradit": "อุตรดิตถ์",
  "Yala": "ยะลา",
  "Yasothon": "ยโสธร"
};

  router.get("/location", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute("SELECT * FROM location");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ POST: เพิ่มข้อมูลสถานที่ (Location)
router.post(
  "/location",
  upload.single("location_images"), 
  async (req: Request, res: Response) => {
    try {
      // 🚩 เพิ่ม Log ตรงนี้เพื่อเช็คว่าไฟล์มาไหม (ดูที่ Terminal ของ VS Code)
      console.log("--- DEBUG START ---");
      console.log("File received:", req.file); 
      console.log("Body received:", req.body);

      const {
        location_name,
        location_province,
        location_district,
        location_subdistrict,
        location_lat,
        location_long
      } = req.body;

      if (!location_name || !location_province || !location_district || !location_subdistrict) {
        return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลสถานที่ให้ครบถ้วน" });
      }

      // ✅ 3. จัดการรูปภาพ (ปรับปรุงการเช็ค)
      let imageUrl: string | null = null;

      if (req.file) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, "locations");
          imageUrl = result.secure_url;
          console.log("Cloudinary Upload Success:", imageUrl);
        } catch (uploadErr: any) {
          console.error("Cloudinary Error:", uploadErr);
          return res.status(500).json({ message: "❌ พังที่ Cloudinary", error: uploadErr.message });
        }
      } else {
        // 🚩 ถ้าเลือกรูปใน Postman แล้วแต่ยังตกมาที่นี่ แสดงว่าชื่อ Key ใน Postman ผิด!
        console.log("No file found in req.file");
      }

      // ✅ 4. บันทึกข้อมูล
      const sql = `INSERT INTO location (
          location_name, 
          location_imges, 
          location_province, 
          location_district, 
          location_subdistrict, 
          location_lat, 
          location_long
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

      const [result]: any = await db.execute(sql, [
        location_name,
        imageUrl, 
        location_province,
        location_district,
        location_subdistrict,
        location_lat || null,
        location_long || null
      ]);

      return res.status(201).json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        imageUrl: imageUrl
      });

    } catch (err: any) {
      console.error("SQL or System Error:", err);
      return res.status(500).json({ 
        message: "❌ Server Error", 
        error: err.message,
        sqlMessage: err.sqlMessage
      });
    }
  }
);

/* ✅ GET: ดึงข้อมูลทั้งหมดจาก LocationType */
router.get("/location_type", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM location_type"
    );
    res.json(rows);
  } catch (err: any) {
    console.error("Error in GET /location_type:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});


///import-json คืออะไร? มันคือ API ที่ “ดึงข้อมูลจากลิงก์” แล้ว “เอามาใส่ DB ให้เราอัตโนมัติ”
router.post("/import-json", async (req: Request, res: Response) => {
  try {
    const url = "https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province_with_district_and_sub_district.json";

    const response = await fetch(url);
   const provinces = (await response.json()) as any[];

    const sql = `INSERT INTO location (
      location_name, 
      location_imges, 
      location_province, 
      location_district, 
      location_subdistrict, 
      location_lat, 
      location_long
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    for (const province of provinces) {
      for (const district of province.districts || []) {
        for (const sub of district.sub_districts || []) {

          await db.execute(sql, [
            sub.name_en,
            "",
            province.name_en,
            district.name_en,
            sub.name_th,
            sub.lat,
            sub.long
          ]);

        }
      }
    }

    res.json({ message: "✅ import success" });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "❌ error", error: err.message });
  }
});

// GET All Locations
router.get("/location_travel", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT 
        lt.*, 
        t.location_type_name,
        l.location_province, 
        l.location_name,
        li.location_image_1,
        li.location_image_2,
        li.location_image_3,
        li.location_image_4,
        li.location_image_5
      FROM location_travel lt
      JOIN location_type t ON lt.localtiontype_id = t.location_type_id
      JOIN location l ON lt.location_id = l.location_id 
      LEFT JOIN location_image li ON lt.id = li.ref_location_travel
    `);

    // เปลี่ยนเฉพาะจังหวัดเป็นภาษาไทย
    const formattedRows = rows.map((row: any) => ({
      ...row,
      location_province: provinceTH[row.location_province] || row.location_province
    }));

    res.json(formattedRows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Locations by Type ID
router.get("/location_travel/type/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows]: any = await db.query(`
      SELECT 
        lt.*, 
        t.location_type_name,
        l.location_province,
        l.location_name,
        li.location_image_1,
        li.location_image_2,
        li.location_image_3,
        li.location_image_4,
        li.location_image_5
      FROM location_travel lt
      JOIN location_type t ON lt.localtiontype_id = t.location_type_id
      JOIN location l ON lt.location_id = l.location_id 
      LEFT JOIN location_image li ON lt.id = li.ref_location_travel
      WHERE lt.localtiontype_id = ?
    `, [id]);

    // เปลี่ยนเฉพาะจังหวัดเป็นภาษาไทย
    const formattedRows = rows.map((row: any) => ({
      ...row,
      location_province: provinceTH[row.location_province] || row.location_province
    }));

    res.json(formattedRows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
export default router;

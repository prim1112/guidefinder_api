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
      "SELECT * FROM locationtype"
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

router.get("/location-travel", async (req: Request, res: Response) => {
  const { type_id } = req.query;

  try {
    let sql = "SELECT * FROM location_travel";
    let params: any[] = [];

    if (type_id) {
      sql += " WHERE localtiontype_id = ?";
      params.push(type_id);
    }

    const [rows]: any = await db.query(sql, params);

    res.json({
      message: "success",
      data: rows,
    });
  } catch (err: any) {
    res.status(500).json({
      message: "error",
      error: err.message,
    });
  }
});

export default router;

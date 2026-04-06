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

// ✅ POST: เพิ่มข้อมูลสถานที่ (Location)
router.post(
  "/location",
  upload.single("location_images"), 
  async (req: Request, res: Response) => {
    try {
      const {
        location_name,
        location_province,
        location_district,
        location_subdistrict,
        location_lat,
        location_long,
        type_id,
      } = req.body;

      // 🔍 1. ตรวจสอบค่าที่จำเป็น (Validation)
      if (!location_name || !location_province || !location_district || !location_subdistrict || !type_id) {
        return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลหลักให้ครบถ้วน" });
      }

      // 🔍 2. ตรวจสอบชื่อสถานที่ซ้ำ
      const [nameRows]: any = await db.execute(
        "SELECT location_name FROM location WHERE LOWER(location_name) = LOWER(?)",
        [location_name]
      );

      if (nameRows.length > 0) {
        return res.status(400).json({ message: "❌ ชื่อสถานที่นี้มีอยู่ในระบบแล้ว" });
      }

      // 🔍 3. ตรวจสอบ type_id ว่ามีในตาราง locationtype จริงไหม
      const [typeRows]: any = await db.execute(
        "SELECT type_id FROM locationtype WHERE type_id = ?",
        [type_id]
      );
      if (typeRows.length === 0) {
        return res.status(400).json({ message: "❌ type_id นี้ไม่มีอยู่ในระบบ" });
      }

      // ✅ 4. จัดการเรื่องรูปภาพ (Cloudinary)
      let imageUrl = "";
      if (req.file) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, "locations");
          imageUrl = result.secure_url;
        } catch (uploadErr) {
          console.error("Cloudinary Upload Error:", uploadErr);
          return res.status(500).json({ message: "❌ เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" });
        }
      }

      // ✅ 5. บันทึกข้อมูล (ตรวจสอบชื่อ Column ใน DB ของคุณให้ตรงเป๊ะ)
      // หมายเหตุ: ผมใส่ชื่อ column ตามที่คุณพิมพ์มาให้ล่าสุด
      const sql = `INSERT INTO location (
          location_name, 
          location_imges, 
          location_province, 
          location_district, 
          location_subdistrict, 
          location_lat, 
          location_long, 
          type_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const [result]: any = await db.execute(sql, [
        location_name,
        imageUrl || null,
        location_province,
        location_district,
        location_subdistrict,
        location_lat || null,
        location_long || null,
        type_id,
      ]);

      return res.status(201).json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        data: { location_name, imageUrl }
      });

    } catch (err: any) {
      // 🚩 จุดนี้จะบอกเราว่าทำไมถึง 500
      console.error("--- ERROR LOG ---");
      console.error(err); 
      return res.status(500).json({ 
        message: "❌ Server Error", 
        error: err.message 
      });
    }
  }
);

// ✅ GET: ดึงข้อมูลทั้งหมดจาก Location
router.get("/location", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM location");
    res.json(rows);
  } catch (err: any) {
    console.error("Error in GET /location:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

router.post("/location_type", async (req: Request, res: Response) => {
  const { nametype } = req.body;

  try {
    if (!nametype) {
      return res.status(400).json({ message: "❌ กรุณากรอก nametype" });
    }

    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO locationtype (nametype) VALUES (?)",
      [nametype]
    );

    res.json({
      message: "✅ เพิ่มข้อมูล LocationType สำเร็จ",
      type_id: result.insertId,
      nametype,
    });
  } catch (err: any) {
    console.error("Error in POST /location_type:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

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

export default router;

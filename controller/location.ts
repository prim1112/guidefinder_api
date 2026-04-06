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
  upload.single("location_images"), // ชื่อ Key ใน Postman ที่ใช้แนบไฟล์รูป
  async (req: Request, res: Response) => {
    try {
      const {
        location_name,
        location_province,
        location_district,
        location_subdistrict,
        location_lat,
        location_long
      } = req.body;

      // 🔍 1. ตรวจสอบค่าที่จำเป็น (Validation) 
      // ตัด type_id ออกจากการเช็ค
      if (!location_name || !location_province || !location_district || !location_subdistrict) {
        return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลสถานที่ให้ครบถ้วน" });
      }

      // 🔍 2. ตรวจสอบชื่อสถานที่ซ้ำ
      const [nameRows]: any = await db.execute(
        "SELECT location_name FROM location WHERE LOWER(location_name) = LOWER(?)",
        [location_name]
      );

      if (nameRows.length > 0) {
        return res.status(400).json({ message: "❌ ชื่อสถานที่นี้มีอยู่ในระบบแล้ว" });
      }

      // ✅ 3. จัดการรูปภาพ (Cloudinary)
      let imageUrl = "";
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, "locations");
        imageUrl = result.secure_url;
      }

      // ✅ 4. บันทึกข้อมูล (ใช้ชื่อ Column ตามที่คุณให้มา 8 ตัว)
      // สังเกต: location_imges (ไม่มีตัว a ตามที่คุณพิมพ์มา)
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
        imageUrl || null,
        location_province,
        location_district,
        location_subdistrict,
        location_lat || null,
        location_long || null
      ]);

      return res.status(201).json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        data: {
          location_name,
          location_province,
          location_imges: imageUrl
        }
      });

    } catch (err: any) {
      console.error("DEBUG ERROR:", err);
      return res.status(500).json({ 
        message: "❌ Server Error", 
        error: err.message 
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

export default router;

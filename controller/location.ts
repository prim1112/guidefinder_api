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

router.post(
  "/location",
  upload.single("location_images"), 
  async (req: Request, res: Response) => {
    try {
      console.log("--- DEBUG START ---");
      console.log("File received:", req.file ? "Yes" : "No"); 
      console.log("Body received:", req.body);

      const {
        location_name,
        location_province,
        location_district,
        location_subdistrict,
        location_lat,
        location_long
      } = req.body;

      // 1. ตรวจสอบข้อมูลบังคับ
      if (!location_name || !location_province || !location_district || !location_subdistrict) {
        return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลสถานที่ให้ครบถ้วน" });
      }

      // 2. จัดการรูปภาพ (ต้องไม่เป็น null เพราะ DB ตั้งค่า NOT NULL)
      let location_imges: string = ""; 

      if (req.file) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, "locations");
          location_imges = result.secure_url;
        } catch (uploadErr: any) {
          console.error("Cloudinary Error:", uploadErr);
          return res.status(500).json({ message: "❌ พังที่ Cloudinary", error: uploadErr.message });
        }
      }

      // 3. บันทึกข้อมูล
      const sql = `INSERT INTO location (
          location_name, 
          location_imges, 
          location_province, 
          location_district, 
          location_subdistrict, 
          location_lat, 
          location_long
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

      // 🚩 จุดที่ต้องระวัง: DB คุณตั้งค่า Province/District/Subdistrict เป็น INT และห้าม NULL
      // และ Lat/Long เป็น Float และห้าม NULL
      const [result]: any = await db.execute(sql, [
        location_name,
        location_imges, // ส่งเป็น String ว่างแทน NULL เพื่อไม่ให้ SQL ฟ้อง
        Number(location_province) || 0,    // แปลงเป็นตัวเลขตาม DB
        Number(location_district) || 0,    // แปลงเป็นตัวเลขตาม DB
        Number(location_subdistrict) || 0, // แปลงเป็นตัวเลขตาม DB
        parseFloat(location_lat) || 0.0,   // ใช้ 0.0 แทน null เพราะ DB ห้าม Null
        parseFloat(location_long) || 0.0
      ]);

      return res.status(201).json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        location_imges: location_imges
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

export default router;

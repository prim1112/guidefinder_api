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

      if (!location_name || !location_province || !location_district || !location_subdistrict) {
        return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลสถานที่ให้ครบถ้วน" });
      }

      // ✅ 3. จัดการรูปภาพ (เปลี่ยนชื่อตัวแปรให้ตรงกับ DB)
      let location_imges: string | null = null; 

      if (req.file) {
        try {
          const result = await uploadToCloudinary(req.file.buffer, "locations");
          location_imges = result.secure_url; // เก็บลงตัวแปรชื่อเดียวกับ DB
          console.log("Cloudinary Upload Success:", location_imges);
        } catch (uploadErr: any) {
          console.error("Cloudinary Error:", uploadErr);
          return res.status(500).json({ message: "❌ พังที่ Cloudinary", error: uploadErr.message });
        }
      }

      // ✅ 4. บันทึกข้อมูล (ใช้ชื่อตัวแปรตรงตามที่คุณต้องการ)
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
        location_imges, // ตัวแปรนี้ต้องประกาศไว้ข้างบน (บรรทัดที่ 26)
        location_province,
        location_district,
        location_subdistrict,
        location_lat || null,
        location_long || null
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

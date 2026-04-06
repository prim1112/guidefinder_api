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
  upload.single("location_images"), // เปลี่ยนชื่อ key รูปภาพให้สื่อความหมาย
  async (req: Request, res: Response) => {
    const {
      location_name,
      location_province,
      location_district,
      location_subdistrict,
      location_lat,
      location_long,
      type_id,
      // เพิ่มฟิลด์อื่นๆ ที่จำเป็น เช่น address หรือ zip_code ถ้าใน DB ยังต้องใช้
    } = req.body;

    let imageUrl = "";

    try {
      // 🔍 1. ตรวจสอบค่าที่จำเป็น (Validation)
      if (
        !location_name ||
        !location_province ||
        !location_district ||
        !location_subdistrict ||
        !type_id
      ) {
        return res
          .status(400)
          .json({ message: "❌ กรุณากรอกข้อมูลหลักให้ครบถ้วน" });
      }

      // 🔍 2. ตรวจสอบชื่อสถานที่ซ้ำ (ใช้ชื่อฟิลด์ใหม่: location_name)
      const [nameRows] = await db.execute<RowDataPacket[]>(
        "SELECT location_name FROM location WHERE LOWER(location_name) = LOWER(?)",
        [location_name]
      );

      if (nameRows.length > 0) {
        return res.status(400).json({
          message: "❌ ชื่อสถานที่นี้มีอยู่ในระบบแล้ว",
        });
      }

      // 🔍 3. ตรวจสอบ type_id
      const [typeRows] = await db.execute<RowDataPacket[]>(
        "SELECT type_id FROM locationtype WHERE type_id = ?",
        [type_id]
      );
      if (typeRows.length === 0) {
        return res
          .status(400)
          .json({ message: "❌ ประเภทสถานที่ (type_id) ไม่ถูกต้อง" });
      }

      // ✅ 4. อัปโหลดรูปขึ้น Cloudinary
      if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "locations");
        imageUrl = result.secure_url;
      }

      // ✅ 5. บันทึกข้อมูลลงฐานข้อมูล (ใช้ชื่อ Column ตามที่คุณให้มา)
      const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO location (
          location_name, 
          location_images, 
          location_province, 
          location_district, 
          location_subdistrict, 
          location_lat, 
          location_long, 
          type_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          location_name,
          imageUrl,
          location_province,
          location_district,
          location_subdistrict,
          location_lat || null, // ถ้าไม่มีให้เป็น null
          location_long || null,
          type_id,
        ]
      );

      res.status(201).json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        data: {
          location_name,
          location_images: imageUrl,
          location_province,
          location_district,
          location_subdistrict,
          location_lat,
          location_long,
          type_id
        },
      });
    } catch (err: any) {
      console.error("Error in POST /location:", err);
      res.status(500).json({ message: "❌ Server Error", error: err.message });
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

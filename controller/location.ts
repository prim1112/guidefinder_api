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
// ✅ POST: เพิ่มข้อมูลสถานที่ (Location)
router.post(
  "/location",
  upload.single("image"),
  async (req: Request, res: Response) => {
    const { name, address, subdistrict, district, province, type_id } =
      req.body;
    let imageUrl = "";

    try {
      // 🔍 ตรวจสอบค่าที่จำเป็น
      if (
        !name ||
        !address ||
        !subdistrict ||
        !district ||
        !province ||
        !type_id
      ) {
        return res
          .status(400)
          .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
      }

      // 🔍 ตรวจสอบว่าชื่อสถานที่ซ้ำหรือไม่
      const [nameRows] = await db.execute<RowDataPacket[]>(
        "SELECT name FROM location WHERE name = ?",
        [name]
      );
      if (nameRows.length > 0) {
        return res
          .status(400)
          .json({ message: "❌ ชื่อสถานที่นี้มีอยู่ในระบบแล้ว" });
      }

      // 🔍 ตรวจสอบว่า type_id มีอยู่ในตาราง LocationType หรือไม่
      const [typeRows] = await db.execute<RowDataPacket[]>(
        "SELECT type_id FROM locationtype WHERE type_id = ?",
        [type_id]
      );
      if (typeRows.length === 0) {
        return res
          .status(400)
          .json({ message: "❌ type_id ไม่ถูกต้อง หรือไม่มีอยู่ในระบบ" });
      }

      // ✅ อัปโหลดรูปขึ้น Cloudinary
      if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "locations");
        imageUrl = result.secure_url;
      }

      // ✅ บันทึกข้อมูลลงฐานข้อมูล
      const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO location (name, address, subdistrict, district, province, image, type_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, address, subdistrict, district, province, imageUrl, type_id]
      );

      res.json({
        message: "✅ เพิ่มข้อมูล Location สำเร็จ",
        location_id: result.insertId,
        data: {
          name,
          address,
          subdistrict,
          district,
          province,
          image: imageUrl,
          type_id,
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

import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ อัปโหลดรูปขึ้น Cloudinary
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

// ✅ Register Guide
router.post(
  "/register",
  upload.single("image_guide"),
  async (req: Request, res: Response) => {
    const {
      name,
      phone,
      email,
      password,
      facebook,
      language,
      tourism_guide_license,
      tourism_business_license,
    } = req.body;

    let imageUrl = "";

    try {
      // 🔍 ตรวจสอบ email ซ้ำ
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT gid FROM guide WHERE email = ?",
        [email]
      );
      if (rows.length > 0) {
        return res.status(400).json({ message: "❌ อีเมลนี้ถูกใช้งานแล้ว" });
      }

      // ✅ Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // ✅ อัปโหลดรูป
      if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "guides");
        imageUrl = result.secure_url;
      }

      // ✅ บันทึกข้อมูลลงฐานข้อมูล
      const [insertResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO guide 
        (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          phone,
          email,
          hashedPassword,
          facebook,
          language,
          imageUrl,
          tourism_guide_license,
          tourism_business_license,
          "pending", // default
        ]
      );

      res.json({
        message: "✅ Guide registered successfully",
        gid: insertResult.insertId,
      });
    } catch (err: any) {
      console.error("Error in register guide:", err);
      res.status(500).json({ message: "❌ Server error", error: err.message });
    }
  }
);

// ✅ ดึงรายชื่อไกด์ทั้งหมด (option เสริม)
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM guide");
    const guides = rows.map((g) => {
      const { password, ...rest } = g;
      return rest;
    });
    res.json(guides);
  } catch (err: any) {
    res.status(500).json({ message: "❌ Server error", error: err.message });
  }
});

export default router;

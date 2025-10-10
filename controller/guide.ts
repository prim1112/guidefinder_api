import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";
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

// ✅ Register Guide (อัปโหลด 3 รูป)
router.post(
  "/register",
  upload.fields([
    { name: "image_guide", maxCount: 1 },
    { name: "tourism_guide_license", maxCount: 1 },
    { name: "tourism_business_license", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const { name, phone, email, password, facebook, language } = req.body;

    let imageGuideUrl = "";
    let guideLicenseUrl = "";
    let businessLicenseUrl = "";

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

      // ✅ อัปโหลดรูปทั้งหมด
      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      if (files?.image_guide?.[0]) {
        const result = await uploadToCloudinary(
          files.image_guide[0].buffer,
          "guides/profile"
        );
        imageGuideUrl = result.secure_url;
      }

      if (files?.tourism_guide_license?.[0]) {
        const result = await uploadToCloudinary(
          files.tourism_guide_license[0].buffer,
          "guides/licenses"
        );
        guideLicenseUrl = result.secure_url;
      }

      if (files?.tourism_business_license?.[0]) {
        const result = await uploadToCloudinary(
          files.tourism_business_license[0].buffer,
          "guides/business"
        );
        businessLicenseUrl = result.secure_url;
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
          imageGuideUrl,
          guideLicenseUrl,
          businessLicenseUrl,
          "pending", // default
        ]
      );

      res.json({
        message: "✅ Guide registered successfully",
        gid: insertResult.insertId,
        uploads: {
          image_guide: imageGuideUrl,
          tourism_guide_license: guideLicenseUrl,
          tourism_business_license: businessLicenseUrl,
        },
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

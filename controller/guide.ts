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
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ✅ ดึงรายชื่อไกด์ทั้งหมด
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

// ✅ สมัครไกด์ (บันทึกลง guide_pending)
router.post(
  "/register_guides",
  upload.fields([
    { name: "guides_imageprofile", maxCount: 1 },
    { name: "guides_imagelicense", maxCount: 1 },
    { name: "guides_image_business_license", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const {
      guides_name,
      guides_phonenumber,
      guides_email,
      guides_password,
      guides_facebook,
      guides_language,
      guides_maxcus,
      guides_pricepercusperday,
      guides_province,
    } = req.body;

    try {
      const [existing] = await db.execute<RowDataPacket[]>(
        "SELECT guides_email FROM guides WHERE guides_email = ? OR guides_phonenumber = ?",
        [guides_email, guides_phonenumber],
      );
      if (existing.length > 0)
        return res
          .status(400)
          .json({ message: "❌ อีเมลหรือเบอร์โทรนี้มีในระบบแล้ว" });

      const files = req.files as any;
      const imageGuideUrl = files?.guides_imageprofile
        ? (
            await uploadToCloudinary(
              files.guides_imageprofile[0].buffer,
              "guides/profile",
            )
          ).secure_url
        : "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";
      const guideLicenseUrl = files?.guides_imagelicense
        ? (
            await uploadToCloudinary(
              files.guides_imagelicense[0].buffer,
              "guides/licenses",
            )
          ).secure_url
        : null;
      const businessLicenseUrl = files?.guides_image_business_license
        ? (
            await uploadToCloudinary(
              files.guides_image_business_license[0].buffer,
              "guides/business",
            )
          ).secure_url
        : null;

      const hashedPassword = await bcrypt.hash(guides_password, 10);

      const [insertResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO guides 
        (guides_name, guides_phonenumber, guides_email, guides_password, 
        guides_facebook, guides_language, guides_imageprofile, guides_imagelicense, 
        guides_image_business_license, guides_province, guides_maxcus, guides_pricepercusperday, guides_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guides_name || null,
          guides_phonenumber || null,
          guides_email || null,
          hashedPassword || null,
          guides_facebook || null,
          guides_language || null,
          imageGuideUrl, // profile
          guideLicenseUrl, // license
          businessLicenseUrl, // business license
          guides_province || null,
          guides_maxcus || 0,
          guides_pricepercusperday || 0,
          0, // guides_status
        ],
      );

      res.json({
        message: "🕒 ลงทะเบียนสำเร็จ! รอการอนุมัติ",
        gid: insertResult.insertId,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "❌ Error", error: err.message });
    }
  },
);

// ✅ อนุมัติไกด์ (ย้ายจาก guide_pending → guide)
router.post("/approve/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guide_pending WHERE gid = ?",
      [gid],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "❌ ไม่พบข้อมูลใน guide_pending" });
    }

    const guide = rows[0] as {
      name: string;
      phone: string;
      email: string;
      password: string;
      facebook: string | null;
      language: string | null;
      image_guide: string | null;
      tourism_guide_license: string | null;
      tourism_business_license: string | null;
    };

    await db.execute(
      `INSERT INTO guide 
      (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        guide.name ?? null,
        guide.phone ?? null,
        guide.email ?? null,
        guide.password ?? null,
        guide.facebook ?? null,
        guide.language ?? null,
        guide.image_guide ?? null,
        guide.tourism_guide_license ?? null,
        guide.tourism_business_license ?? null,
      ],
    );

    await db.execute("DELETE FROM guide_pending WHERE gid = ?", [gid ?? null]);

    res.json({
      message: "✅ อนุมัติสำเร็จ และย้ายข้อมูลไปยังตาราง Guide แล้ว",
      moved_data: {
        name: guide.name,
        email: guide.email,
        phone: guide.phone,
      },
    });
  } catch (err: any) {
    console.error("Error in approve guide:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

// ❌ ปฏิเสธไกด์ (ลบออกจาก guide_pending โดยไม่ย้ายไป guide)
router.delete("/reject/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guide_pending WHERE gid = ?",
      [gid],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "❌ ไม่พบข้อมูลใน guide_pending" });
    }

    const guide = rows[0] as { name: string; email: string; phone: string };

    await db.execute("DELETE FROM guide_pending WHERE gid = ?", [gid ?? null]);

    res.json({
      message: "🗑️ ลบข้อมูลไกด์ที่สมัครมา (ไม่อนุมัติ) เรียบร้อยแล้ว",
      deleted_data: {
        name: guide.name,
        email: guide.email,
        phone: guide.phone,
      },
    });
  } catch (err: any) {
    console.error("Error in reject guide:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

export default router;

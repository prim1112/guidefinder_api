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
      // 🔍 ตรวจสอบอีเมลซ้ำ
      const [emailRows] = await db.execute<RowDataPacket[]>(
        `SELECT email FROM guide WHERE email = ?
         UNION
         SELECT email FROM guide_pending WHERE email = ?
         UNION
         SELECT email FROM customer WHERE email = ?`,
        [email, email, email]
      );
      if (emailRows.length > 0) {
        return res.status(400).json({
          message:
            "❌ อีเมลนี้ถูกใช้งานแล้ว (ซ้ำกับ Guide, Pending หรือ Customer)",
        });
      }

      // 🔍 ตรวจสอบเบอร์โทรซ้ำ
      const [phoneRows] = await db.execute<RowDataPacket[]>(
        `SELECT phone FROM guide WHERE phone = ?
         UNION
         SELECT phone FROM guide_pending WHERE phone = ?
         UNION
         SELECT phone FROM customer WHERE phone = ?`,
        [phone, phone, phone]
      );
      if (phoneRows.length > 0) {
        return res.status(400).json({
          message:
            "❌ เบอร์โทรนี้ถูกใช้งานแล้ว (ซ้ำกับ Guide, Pending หรือ Customer)",
        });
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

      // ✅ บันทึกข้อมูลลง guide_pending (รออนุมัติ)
      const [insertResult] = await db.execute<ResultSetHeader>(
        `INSERT INTO guide_pending 
        (name, phone, email, password, facebook, language, image_guide, tourism_guide_license, tourism_business_license)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name ?? null,
          phone ?? null,
          email ?? null,
          hashedPassword ?? null,
          facebook ?? null,
          language ?? null,
          imageGuideUrl ?? null,
          guideLicenseUrl ?? null,
          businessLicenseUrl ?? null,
        ]
      );

      res.json({
        message: "🕒 Guide registered successfully (รอการอนุมัติจากแอดมิน)",
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

// ✅ อนุมัติไกด์ (ย้ายจาก guide_pending → guide)
router.post("/approve/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guide_pending WHERE gid = ?",
      [gid]
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
      ]
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
      [gid]
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

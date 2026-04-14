import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

//  Cloudinary
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

// get guides
router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM guides");

    const guides = rows.map(({ password, ...rest }: any) => rest);

    return res.json({
      message: "ดึงข้อมูล Guides สำเร็จ",
      count: guides.length,
      data: guides,
    });
  } catch (error: any) {
    console.error("GET /guides error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

router.post(
  "/register_guides",
  async (req: Request, res: Response): Promise<any> => {
    try {
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

        // รับ base64
        guides_imageprofile,
        guides_imagelicense,
        guides_image_business_license
      } = req.body;

      // ✅ Validate Text
      if (!guides_name || !guides_phonenumber || !guides_email || !guides_password || 
          !guides_province || !guides_maxcus || !guides_pricepercusperday) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
      }

      // ❗ Validate รูป (ต้องมี)
      if (!guides_imagelicense || !guides_image_business_license) {
        return res.status(400).json({ message: "กรุณาอัปโหลดใบอนุญาต" });
      }

      // 🔍 เช็คซ้ำ
      const [existing]: any = await db.query(
        "SELECT guides_id FROM guides WHERE guides_email = ? OR guides_phonenumber = ?",
        [guides_email, guides_phonenumber]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        return res.status(400).json({ message: "อีเมลหรือเบอร์นี้มีแล้ว" });
      }

      // 📤 upload base64 ไป Cloudinary
      const uploadBase64 = async (base64: string, folder: string) => {
        const result = await cloudinary.uploader.upload(base64, {
          folder: folder,
        });
        return result.secure_url;
      };

      // 🖼️ profile (ไม่มีก็ default)
      let profileUrl = "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";
      if (guides_imageprofile) {
        profileUrl = await uploadBase64(guides_imageprofile, "guides/profile");
      }

      // 🖼️ license
      const licenseUrl = await uploadBase64(guides_imagelicense, "guides/licenses");

      // 🖼️ business
      const businessUrl = await uploadBase64(guides_image_business_license, "guides/business");

      // 🔐 hash password
      const hashedPassword = await bcrypt.hash(guides_password, 10);

      // 💾 insert DB
      const sql = `
        INSERT INTO guides (
          guides_name, 
          guides_phonenumber, 
          guides_email, 
          guides_password, 
          guides_language, 
          guides_facebook, 
          guides_imageprofile, 
          guides_imagelicense, 
          guides_image_business_license, 
          guides_province, 
          guides_maxcus, 
          guides_pricepercusperday, 
          guides_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        guides_name,
        guides_phonenumber,
        guides_email,
        hashedPassword,
        guides_language || "",
        guides_facebook || "",
        profileUrl,
        licenseUrl,
        businessUrl,
        guides_province,
        Number(guides_maxcus),
        Number(guides_pricepercusperday),
        0
      ];

      const [result]: any = await db.query(sql, values);

      return res.status(201).json({
        message: "ลงทะเบียนสำเร็จ",
        guideId: result.insertId
      });

    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        message: "Server Error",
        error: error.message
      });
    }
  }
);

// accept guide_pending → guide
router.post("/approve/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  const conn = await db.getConnection(); // ใช้ transaction

  try {
    await conn.beginTransaction();

    // get data from pending
    const [rows]: any = await conn.query(
      "SELECT * FROM guide_pending WHERE gid = ?",
      [gid]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({
        message: "ไม่พบข้อมูลใน guide_pending",
      });
    }

    const guide = rows[0];

    // insert 
    await conn.query(
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

    // delete from pending
    await conn.query("DELETE FROM guide_pending WHERE gid = ?", [gid]);

    await conn.commit();

    return res.json({
      message: "อนุมัติสำเร็จ และย้ายข้อมูลแล้ว",
      moved_data: {
        name: guide.name,
        email: guide.email,
        phone: guide.phone,
      },
    });
  } catch (error: any) {
    await conn.rollback();

    console.error("POST /approve/:gid error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  } finally {
    conn.release(); 
  }
});

// reject  guide_pending 
router.delete("/reject/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    // chack data 
    const [rows]: any = await db.query(
      "SELECT name, email, phone FROM guide_pending WHERE gid = ?",
      [gid]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลใน guide_pending",
      });
    }

    const guide = rows[0];

    await db.query("DELETE FROM guide_pending WHERE gid = ?", [gid]);

    return res.json({
      message: "ลบข้อมูลไกด์ที่สมัครมาเรียบร้อยแล้ว",
      deleted_data: {
        name: guide.name,
        email: guide.email,
        phone: guide.phone,
      },
    });
  } catch (error: any) {
    console.error("DELETE /reject/:gid error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;
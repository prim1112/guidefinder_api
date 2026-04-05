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
  upload.fields([
    { name: "guides_imageprofile", maxCount: 1 },
    { name: "guides_imagelicense", maxCount: 1 },
    { name: "guides_image_business_license", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
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
      } = req.body;

      const files = req.files as any;

      // 🔍 1. บังคับกรอกข้อมูลทุกช่อง (Validation)
      if (
        !guides_name || !guides_phonenumber || !guides_email || !guides_password ||
        !guides_language || !guides_facebook || !guides_province ||
        !guides_maxcus || !guides_pricepercusperday
      ) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
      }

      // 🔍 2. บังคับอัปโหลดรูปภาพครบทั้ง 3 รูป
      if (
        !files?.guides_imageprofile?.[0] || 
        !files?.guides_imagelicense?.[0] || 
        !files?.guides_image_business_license?.[0]
      ) {
        return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพให้ครบทั้ง 3 รายการ" });
      }

      // 🔍 3. Check อีเมล/เบอร์โทรซ้ำ
      const [existing]: any = await db.query(
        "SELECT guides_email FROM guides WHERE guides_email = ? OR guides_phonenumber = ?",
        [guides_email, guides_phonenumber]
      );

      if (existing.length) {
        return res.status(400).json({ message: "อีเมลหรือเบอร์โทรนี้มีในระบบแล้ว" });
      }

      // ฟังก์ชันช่วยอัปโหลดรูป (ถ้าพลาดให้ throw error เพื่อเข้า catch ใหญ่)
      const uploadImage = async (file: any, folderPath: string) => {
        const result = await uploadToCloudinary(file.buffer, folderPath);
        if (!result || !result.secure_url) {
          throw new Error(`Failed to upload image to ${folderPath}`);
        }
        return result.secure_url;
      };

      // 🔍 4. อัปโหลดรูปภาพ (ถ้ามีอันไหนพลาด ระบบจะเด้งไป catch ด้านล่างทันที)
      const imageGuideUrl = await uploadImage(files.guides_imageprofile[0], "guides/profile");
      const guideLicenseUrl = await uploadImage(files.guides_imagelicense[0], "guides/licenses");
      const businessLicenseUrl = await uploadImage(files.guides_image_business_license[0], "guides/business");

      // 🔍 5. Hash Password
      const hashedPassword = await bcrypt.hash(guides_password, 10);

      // 🔍 6. Insert ลง Database
      const sql = `
        INSERT INTO guides 
        (
          \`guides_name\`, \`guides_phonenumber\`, \`guides_email\`, \`guides_password\`, 
          \`guides_language\`, \`guides_facebook\`, \`guides_imageprofile\`, \`guides_imagelicense\`, 
          \`guides_image_business_license\`, \`guides_province\`, \`guides_maxcus\`, \`guides_pricepercusperday\`, \`guides_status\`
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        guides_name,
        guides_phonenumber,
        guides_email,
        hashedPassword,
        guides_language,
        guides_facebook,
        imageGuideUrl,
        guideLicenseUrl,      
        businessLicenseUrl,
        guides_province,
        Number(guides_maxcus),
        Number(guides_pricepercusperday),
        0 // guides_status
      ];

      const [result]: any = await db.query(sql, values);

      return res.status(201).json({
        message: "ลงทะเบียนสำเร็จ! รอการอนุมัติ",
        gid: result.insertId,
      });

    } catch (error: any) {
      console.error("POST /register_guides error:", error);
      
      // ถ้า Error มาจาก Cloudinary หรือ Database จะถูกส่งกลับที่นี่
      return res.status(500).json({ 
        message: "เกิดข้อผิดพลาดภายในระบบ", 
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
import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { sendGuideApprovedEmail, sendGuideRejectedEmail,} from "../src/services/mail.service";

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

router.get("/province/:province", async (req: Request, res: Response) => {
  const province = req.params.province?.trim();

  try {
    // เช็ก province ว่าง
    if (!province) {
      return res.status(400).json({
        message: "กรุณาระบุจังหวัด",
      });
    }

    const [rows]: any = await db.query(
      `
      SELECT 
        guides_id,
        guides_name,
        guides_language,
        guides_imageprofile,
        guides_pricepercusperday,
        guides_province,
        guides_facebook
      FROM guides
      WHERE guides_province = ?
      AND guides_status = 1
      `,
      [province],
    );

    return res.json({
      message: "ดึงข้อมูลไกด์สำเร็จ",
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    console.error("GET GUIDE BY PROVINCE ERROR:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

router.get("/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    /// ✅ ดึงข้อมูลไกด์ก่อน
    const [guideRows]: any = await db.query(
      `
      SELECT 
        guides_id,
        guides_name,
        guides_language,
        guides_province,
        guides_imageprofile,
        guides_maxcus,
        guides_pricepercusperday
      FROM guides
      WHERE guides_id = ?
      `,
      [gid],
    );

    /// ❌ ไม่พบไกด์
    if (!guideRows || guideRows.length === 0) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลไกด์",
        data: null,
      });
    }

    const guide = guideRows[0];

    /// ✅ ดึงสถานที่ท่องเที่ยวทั้งหมดในจังหวัด
    const [travelRows]: any = await db.query(
      `
      SELECT
        lt.id AS travel_id,
        lt.travel_name,
        lt.travel_image,

        l.location_id,
        l.location_name,
        l.location_province

      FROM location_travel lt

      LEFT JOIN location l
        ON lt.location_id = l.location_id

      WHERE TRIM(l.location_province)
        = TRIM(?)
      `,
      [guide.guides_province],
    );

    /// ✅ ส่งข้อมูลกลับ
    return res.json({
      data: {
        guides_id: guide.guides_id,
        guides_name: guide.guides_name,
        guides_language: guide.guides_language,
        guides_province: guide.guides_province,
        guides_imageprofile: guide.guides_imageprofile,
        guides_maxcus: guide.guides_maxcus,
        guides_pricepercusperday: guide.guides_pricepercusperday,

        /// ✅ สถานที่ท่องเที่ยวทั้งหมด
        travels: travelRows,
      },
    });
  } catch (err: any) {
    console.error("GUIDE DETAIL ERROR:", err.message);

    return res.status(500).json({
      message: "server error",
      error: err.message,
    });
  }
});

// register guide
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
      // 🔍 validate
      if (!guides_email || !guides_password || !guides_phonenumber) {
        return res.status(400).json({
          message: "กรุณากรอก email, password และเบอร์โทร",
        });
      }

      // 🔍 check duplicate
      const [existing]: any = await db.query(
        "SELECT guides_email FROM guides WHERE guides_email = ? OR guides_phonenumber = ?",
        [guides_email, guides_phonenumber],
      );

      if (existing.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์โทรนี้มีในระบบแล้ว",
        });
      }

      const files = req.files as any;

      //upload image
      const uploadImage = async (file: any, path: string) => {
        if (!file) return null;
        const result = await uploadToCloudinary(file.buffer, path);
        return result.secure_url;
      };

      const imageGuideUrl =
        (await uploadImage(
          files?.guides_imageprofile?.[0],
          "guides/profile",
        )) ||
        "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";

      const guideLicenseUrl = await uploadImage(
        files?.guides_imagelicense?.[0],
        "guides/licenses",
      );

      const businessLicenseUrl = await uploadImage(
        files?.guides_image_business_license?.[0],
        "guides/business",
      );

      //hash password
      const hashedPassword = await bcrypt.hash(guides_password, 10);

      // insert
      const [result]: any = await db.query(
        `INSERT INTO guides 
        (guides_name, guides_phonenumber, guides_email, guides_password, 
        guides_facebook, guides_language, guides_imageprofile, guides_imagelicense, 
        guides_image_business_license, guides_province, guides_maxcus, guides_pricepercusperday, guides_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guides_name || null,
          guides_phonenumber,
          guides_email,
          hashedPassword,
          guides_facebook || null,
          guides_language || null,
          imageGuideUrl,
          guideLicenseUrl,
          businessLicenseUrl,
          guides_province || null,
          guides_maxcus ?? 0,
          guides_pricepercusperday ?? 0,
          0,
        ],
      );

      return res.status(201).json({
        message: "ลงทะเบียนสำเร็จ! รอการอนุมัติ",
        gid: result.insertId,
      });
    } catch (error: any) {
      console.error("POST /register_guides error:", error);

      return res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  },
);

router.post("/approve/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // ค้นหาข้อมูลไกด์
    const [rows]: any = await conn.query(
      `SELECT guides_id,
              guides_name,
              guides_email
       FROM guides
       WHERE guides_id = ?`,
      [gid],
    );

    if (!rows.length) {
      await conn.rollback();

      return res.status(404).json({
        message: `ไม่พบข้อมูลไกด์รหัส ${gid}`,
      });
    }

    // อนุมัติไกด์
    await conn.query(
      `UPDATE guides
       SET guides_status = 1
       WHERE guides_id = ?`,
      [gid],
    );

    // ส่งอีเมลแจ้งอนุมัติ
    await sendGuideApprovedEmail(rows[0].guides_email, rows[0].guides_name);

    await conn.commit();

    return res.status(200).json({
      message: "อนุมัติไกด์สำเร็จและส่งอีเมลแล้ว",
      gid,
    });
  } catch (error: any) {
    await conn.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  } finally {
    conn.release();
  }
});

// ==================== REJECT GUIDE ====================
router.put("/reject/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    // ค้นหาข้อมูลไกด์
    const [rows]: any = await db.query(
      `SELECT guides_id,
              guides_name,
              guides_email
       FROM guides
       WHERE guides_id = ?`,
      [gid],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "ไม่พบไกด์",
      });
    }

    // เปลี่ยนสถานะเป็น Rejected
    await db.query(
      `UPDATE guides
       SET guides_status = 2
       WHERE guides_id = ?`,
      [gid],
    );

    // ส่งอีเมลแจ้งไม่ผ่านการอนุมัติ
    await sendGuideRejectedEmail(rows[0].guides_email, rows[0].guides_name);

    return res.status(200).json({
      message: "ปฏิเสธไกด์และส่งอีเมลแล้ว",
      gid,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const [result]: any = await db.query(
      "DELETE FROM guides WHERE guides_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบไกด์",
      });
    }

    return res.json({
      success: true,
      message: "ลบไกด์สำเร็จ",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

router.get("/profile/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const [rows]: any = await db.query(
      `SELECT 
        guides_id,
        guides_name,
        guides_phonenumber,
        guides_email,
        guides_language,
        guides_facebook,
        guides_imageprofile,
        guides_imagelicense,
        guides_image_business_license,
        guides_province,
        guides_maxcus,
        guides_pricepercusperday,
        guides_status
      FROM guides
      WHERE guides_id = ?`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลไกด์",
      });
    }

    const g = rows[0];

    return res.json({
      message: "ดึงข้อมูลสำเร็จ",
      data: {
        guides_id: g.guides_id,
        guides_name: g.guides_name,
        guides_phonenumber: g.guides_phonenumber,
        guides_email: g.guides_email,
        guides_language: g.guides_language,
        guides_facebook: g.guides_facebook,
        guides_imageprofile: g.guides_imageprofile,
        guides_imagelicense: g.guides_imagelicense,
        guides_image_business_license: g.guides_image_business_license,
        guides_province: g.guides_province,
        guides_maxcus: g.guides_maxcus,
        guides_pricepercusperday: g.guides_pricepercusperday,
        guides_status: g.guides_status,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

// UPDATE GUIDE PROFILE
router.put(
  "/profile/:id",
  upload.single("guides_imageprofile"),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const {
        guides_name,
        guides_phonenumber,
        guides_email,
        guides_password,
        confirm_password,
        guides_facebook,
        guides_language,
      } = req.body;

      // 🔥 [VALIDATION] เพิ่มการบังคับกรอก Facebook และ ภาษา เข้าไปในระบบตรวจเช็คหลัก
      if (!guides_name || !guides_phonenumber || !guides_email || !guides_facebook || !guides_language) {
        return res.status(400).json({
          message: "กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง (ชื่อ, เบอร์โทรศัพท์, อีเมล, Facebook, ภาษา)",
        });
      }

      // ตรวจสอบว่ามีไกด์ในระบบไหม
      const [rows]: any = await db.query(
        "SELECT * FROM guides WHERE guides_id = ?",
        [id],
      );
      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบข้อมูลไกด์" });
      }
      const old = rows[0];

      // ตรวจสอบรหัสผ่าน
      if (guides_password && guides_password !== confirm_password) {
        return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
      }

      const email = guides_email.toLowerCase();

      // ตรวจสอบข้อมูลซ้ำในระบบ
      const [dup]: any = await db.query(
        `SELECT guides_id FROM guides 
         WHERE (guides_email = ? OR guides_phonenumber = ?) AND guides_id != ?`,
        [email, guides_phonenumber, id],
      );
      if (dup.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์โทรศัพท์ถูกใช้งานในระบบแล้ว",
        });
      }

      let password = old.guides_password;
      if (guides_password) {
        password = await bcrypt.hash(guides_password, 10);
      }

      let image = old.guides_imageprofile;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "guides/profile");
        image = result.secure_url;
      }

      // ✅ [SQL UPDATE] สั่งบันทึกตรง ๆ ได้เลย เพราะค่าถูกคัดกรองว่าไม่ว่างแน่นอนแล้ว
      await db.query(
        `UPDATE guides SET 
          guides_name = ?, 
          guides_phonenumber = ?, 
          guides_email = ?, 
          guides_password = ?, 
          guides_facebook = ?,
          guides_language = ?,
          guides_imageprofile = ? 
        WHERE guides_id = ?`,
        [
          guides_name,        
          guides_phonenumber, 
          email,              
          password,
          guides_facebook, 
          guides_language, 
          image,
          id,
        ],
      );

      res.json({
        success: true,
        message: "อัปเดตโปรไฟล์ไกด์สำเร็จ",
      });
    } catch (err: any) {
      console.error("Update Guide Error:", err);
      res.status(500).json({ message: err.message });
    }
  },
);

router.post(
  "/re-submit/:id",
  upload.fields([
    { name: "guides_imageprofile", maxCount: 1 },
    { name: "guides_imagelicense", maxCount: 1 },
    { name: "guides_image_business_license", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      // 1. ดึงค่า ID จาก URL ออกมาตรงๆ (ค่าเริ่มต้นจะเป็น String)
      const id = req.params.id; 
      const { 
        guides_name, 
        guides_phonenumber, 
        guides_email, 
        guides_facebook, 
        guides_language 
      } = req.body;

      // 2. ตรวจสอบข้อมูลเก่าในระบบ (ค้นหาไกด์จาก ID ที่แอป Flutter ส่งมา)
      const [rows]: any = await db.query("SELECT * FROM guides WHERE guides_id = ?", [id]);
      if (!rows.length) return res.status(404).json({ message: "ไม่พบข้อมูลไกด์ในระบบ" });
      const oldData = rows[0];

      // 3. คลีนค่าข้อมูลให้บริสุทธิ์ (ตัดช่องว่าง, ทำตัวพิมพ์เล็ก, และตัดขีดแดชออกให้เหลือแต่ตัวเลขล้วน)
      const email = guides_email ? guides_email.toLowerCase().trim() : "";
      const phoneNumber = guides_phonenumber ? guides_phonenumber.replace(/\D/g, "").trim() : ""; 

      // 4. ตรวจสอบอีเมล/เบอร์โทรซ้ำ 
      // ใช้ REPLACE ลบแดชฝั่ง DB และใช้ CAST ครอบทั้งสองฝั่งเพื่อป้องกันบั๊กประเภทข้อมูล (INT vs VARCHAR) บน Render
      const [dup]: any = await db.query(
        `SELECT guides_id, guides_name, guides_email, guides_phonenumber FROM guides 
         WHERE (LOWER(guides_email) = ? OR REPLACE(guides_phonenumber, '-', '') = ?) 
         AND CAST(guides_id AS CHAR) != CAST(? AS CHAR)`, 
        [email, phoneNumber, id]
      );
      
      if (dup.length) {
        // 🔴 ระบบสืบสวนระบุตัวปัญหาบน Render Logs
        console.log("=================================================");
        console.log("❌ [RENDER BUG DETECTED] ตรวจพบข้อมูลซ้ำซ้อน!");
        console.log(`-> คุณส่ง ID จากแอปมาแก้ไขคือ: ${id}`);
        console.log(`-> แต่มันดันไปซ้ำกับไกด์อีกแถวที่มีอยู่แล้วใน DB คือ ID: ${dup[0].guides_id}`);
        console.log(`-> ชื่อของแถวที่ซ้ำ: ${dup[0].guides_name}`);
        console.log(`-> อีเมลที่ซ้ำ: ${dup[0].guides_email}`);
        console.log(`-> เบอร์ที่ซ้ำ: ${dup[0].guides_phonenumber}`);
        console.log("=================================================");

        return res.status(400).json({ message: "อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
      }

      // 5. จัดการอัปโหลดรูปภาพใหม่เข้า Cloudinary (ถ้าไม่มีการเลือกใหม่ ให้ใช้ URL เดิม)
      const files = req.files as any;
      const uploadImage = async (file: any, path: string, oldUrl: string) => {
        if (file && file[0]?.buffer) {
          const result = await uploadToCloudinary(file[0].buffer, path);
          return result.secure_url;
        }
        return oldUrl;
      };

      const imageProfile = await uploadImage(files?.guides_imageprofile, "guides/profile", oldData.guides_imageprofile);
      const imageLicense = await uploadImage(files?.guides_imagelicense, "guides/licenses", oldData.guides_imagelicense);
      const imageBusiness = await uploadImage(files?.guides_image_business_license, "guides/business", oldData.guides_image_business_license);

      // 6. อัปเดตข้อมูลลง Database และดีดสถานะกลับไปเป็น 0 (รอตรวจสอบรอบใหม่)
      await db.query(
        `UPDATE guides SET 
          guides_name = ?, 
          guides_phonenumber = ?, 
          guides_email = ?, 
          guides_facebook = ?, 
          guides_language = ?, 
          guides_imageprofile = ?, 
          guides_imagelicense = ?, 
          guides_image_business_license = ?, 
          guides_status = 0
        WHERE guides_id = ?`,
        [
          guides_name, 
          phoneNumber, // บันทึกแบบเบอร์สะอาดตัวเลขล้วน
          email, 
          guides_facebook, 
          guides_language, 
          imageProfile, 
          imageLicense, 
          imageBusiness, 
          id
        ]
      );

      return res.json({ 
        success: true, 
        message: "ส่งเอกสารแก้ไขเรียบร้อยแล้ว ระบบจะทำการตรวจสอบอีกครั้งภายใน 1-3 วันทำการค่ะ" 
      });

    } catch (err: any) {
      console.error("Re-submit Error:", err);
      return res.status(500).json({ message: "Server Error", error: err.message });
    }
  }
);

//  DELETE GUIDE PROFILE
router.delete("/profile/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    // =========================
    // หา booking ของ guide
    // =========================
    const [bookings]: any = await db.query(
      "SELECT booking_queue_id FROM booking_queues WHERE ref_guid_id = ?",
      [id],
    );

    console.log("BOOKING COUNT =>", bookings.length);

    // =========================
    // ลบ review ก่อน
    // =========================
    for (const booking of bookings) {
      await db.query("DELETE FROM review_guides WHERE booking_queue_id = ?", [
        booking.booking_queue_id,
      ]);
    }

    // =========================
    // ลบ booking
    // =========================
    await db.query("DELETE FROM booking_queues WHERE ref_guid_id = ?", [id]);

    // =========================
    // ลบ guide
    // =========================
    const [result]: any = await db.query(
      "DELETE FROM guides WHERE guides_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "ไม่พบไกด์",
      });
    }

    return res.status(200).json({
      message: "ลบบัญชีสำเร็จ",
    });
  } catch (error: any) {
    console.error("DELETE ERROR =", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code,
    });
  }
});

export default router;

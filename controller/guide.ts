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
    let {
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
      // NORMALIZE 
      guides_name = guides_name?.trim();
      guides_email = guides_email?.trim().toLowerCase();
      // 💡 ปรับปรุง: ล้างขีด (-) เผื่อกรณีหน้าบ้านส่งเลขฟอร์แมตติดมา ให้เหลือตัวเลขดิบ 10 หลัก
      guides_phonenumber = guides_phonenumber?.trim().replace(/\D/g, "");

      // VALIDATION
      if (!guides_email || !guides_password || !guides_phonenumber) {
        return res.status(400).json({
          success: false,
          message: "❌ กรุณากรอก email, password และเบอร์โทรให้ครบถ้วน",
        });
      }

      //CHECK DUPLICATE (LAST-DEFENSE)
      //ระบบความปลอดภัยขั้นสุดท้าย ป้องกันการยิง API ตรงโดยไม่ผ่านหน้าแรก
      const [existing]: any = await db.query(
        `SELECT 'admin' AS origin_table, admin_email AS email, admin_phonenumber AS phone FROM admin WHERE admin_email = ? OR admin_phonenumber = ?
         UNION
         SELECT 'guide' AS origin_table, guides_email AS email, guides_phonenumber AS phone FROM guides WHERE guides_email = ? OR guides_phonenumber = ?
         UNION
         SELECT 'customer' AS origin_table, cus_email AS email, cus_phonenumber AS phone FROM customers WHERE cus_email = ? OR cus_phonenumber = ?`,
        [
          guides_email, guides_phonenumber, // ตาราง admin
          guides_email, guides_phonenumber, // ตาราง guides (ปรับชื่อจำลองเป็น 'guide')
          guides_email, guides_phonenumber  // ตาราง customers (ปรับชื่อจำลองเป็น 'customer')
        ]
      );

      if (existing.length > 0) {
        const isEmailDup = existing.some((row: any) => row.email === guides_email);
        const isPhoneDup = existing.some((row: any) => row.phone === guides_phonenumber);
        
        const matchedRole = existing[0].origin_table; 
        let roleThai = "ระบบ";
        if (matchedRole === "admin") roleThai = "แอดมิน";
        if (matchedRole === "guide") roleThai = "ไกด์คนอื่น"; // 💡 แก้ไขลอจิกเทียบคำให้ตรงกัน
        if (matchedRole === "customer") roleThai = "ลูกค้า";

        let alertMessage = "❌ ข้อมูลนี้ถูกใช้งานในระบบแล้ว";
        if (isEmailDup && isPhoneDup) {
          alertMessage = `❌ อีเมลและเบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
        } else if (isEmailDup) {
          alertMessage = `❌ อีเมลนี้ถูกใช้งานแล้วโดย (${roleThai})`;
        } else if (isPhoneDup) {
          alertMessage = `❌ เบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
        }

        return res.status(409).json({
          success: false,
          message: alertMessage,
        });
      }

      // ================= FILE UPLOAD PROCESS =================
      const files = req.files as any;

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

      // ================= HASH PASSWORD =================
      const hashedPassword = await bcrypt.hash(guides_password, 10);

      // ================= INSERT =================
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
        success: true,
        message: "✅ ลงทะเบียนสำเร็จ! รอการอนุมัติ",
        gid: result.insertId,
      });
    } catch (error: any) {
      console.error("POST /register_guides error:", error);

      return res.status(500).json({
        success: false,
        message: "❌ Server Error",
        error: error.message,
      });
    }
  },
);

// POST: /check-duplicate (สำหรับใช้หน้าแรกของแอปเพื่อเช็ก อีเมล/เบอร์โทร ซ้ำข้ามตาราง)
router.post("/check-duplicate", async (req: Request, res: Response) => {
  try {
    let { email, phone } = req.body;

    // เคลียร์ฟอร์แมตข้อมูลเบื้องต้น
    email = email?.trim().toLowerCase();
    phone = phone?.trim().replace(/\D/g, ""); // ลบขีด (-) ออกให้เหลือเลขดิบ 10 หลัก

    if (!email || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: "❌ ข้อมูลไม่ครบถ้วน (ต้องการ email และ phone)" 
      });
    }

    // ยิง SQL คิวรีสแกนหาข้อมูลข้ามตาราง (admin, guides, customers)
    const [existing]: any = await db.query(
      `SELECT 'admin' AS origin_table, admin_email AS email, admin_phonenumber AS phone FROM admin WHERE admin_email = ? OR admin_phonenumber = ?
       UNION
       SELECT 'guide' AS origin_table, guides_email AS email, guides_phonenumber AS phone FROM guides WHERE guides_email = ? OR guides_phonenumber = ?
       UNION
       SELECT 'customer' AS origin_table, cus_email AS email, cus_phonenumber AS phone FROM customers WHERE cus_email = ? OR cus_phonenumber = ?`,
      [
        email, phone, // ตาราง admin
        email, phone, // ตาราง guides
        email, phone  // ตาราง customers
      ]
    );

    // ถ้าเจอข้อมูลซ้ำในระบบ
    if (existing.length > 0) {
      const isEmailDup = existing.some((row: any) => row.email === email);
      const isPhoneDup = existing.some((row: any) => row.phone === phone);
      
      const matchedRole = existing[0].origin_table; 
      let roleThai = "ระบบ";
      if (matchedRole === "admin") roleThai = "แอดมิน";
      if (matchedRole === "guide") roleThai = "ไกด์คนอื่น";
      if (matchedRole === "customer") roleThai = "ลูกค้า";

      let alertMessage = "❌ ข้อมูลนี้ถูกใช้งานในระบบแล้ว";
      if (isEmailDup && isPhoneDup) {
        alertMessage = `❌ อีเมลและเบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
      } else if (isEmailDup) {
        alertMessage = `❌ อีเมลนี้ถูกใช้งานแล้วโดย (${roleThai})`;
      } else if (isPhoneDup) {
        alertMessage = `❌ เบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
      }

      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: alertMessage,
      });
    }

    // 🎉 ถ้าผ่านฉลุย ไม่มีใครซ้ำเลย
    return res.status(200).json({
      success: true,
      isDuplicate: false,
      message: "✅ ข้อมูลนี้สามารถใช้งานได้"
    });

  } catch (err: any) {
    console.error("🔥 Error in /check-duplicate:", err);
    return res.status(500).json({ 
      success: false, 
      message: "❌ Server Error", 
      error: err.message 
    });
  }
});

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

//REJECT GUIDE
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
      let {
        guides_name,
        guides_phonenumber,
        guides_email,
        guides_password,
        confirm_password,
        guides_facebook,
        guides_language,
      } = req.body;

      // ================= NORMALIZE =================
      guides_name = guides_name?.trim();
      guides_email = guides_email?.trim().toLowerCase();
      // 💡 ล้างเครื่องหมายขีด (-) ออกจากเบอร์โทรศัพท์ให้เหลือเฉพาะตัวเลขดิบ 10 หลัก
      guides_phonenumber = guides_phonenumber?.trim().replace(/\D/g, "");

      // ================= VALIDATION =================
      if (!guides_name || !guides_phonenumber || !guides_email || !guides_facebook || !guides_language) {
        return res.status(400).json({
          success: false,
          message: "❌ กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง (ชื่อ, เบอร์โทรศัพท์, อีเมล, Facebook, ภาษา)",
        });
      }

      // ตรวจสอบว่ามีไกด์คนนี้ในระบบจริงไหม
      const [rows]: any = await db.query(
        "SELECT * FROM guides WHERE guides_id = ?",
        [id],
      );
      if (!rows.length) {
        return res.status(404).json({ success: false, message: "❌ ไม่พบข้อมูลไกด์ในระบบ" });
      }
      const old = rows[0];

      // ตรวจสอบรหัสผ่านกรณีมีการกรอกเข้ามาใหม่
      if (guides_password && guides_password !== confirm_password) {
        return res.status(400).json({ success: false, message: "❌ รหัสผ่านใหม่ไม่ตรงกัน" });
      }

      //CHECK DUPLICATE (CROSS-TABLES)
      // 💡 ค้นหาข้ามตาราง และยกเว้นไอดีของตัวเอง (id != ?) เฉพาะในตาราง guides
      const [existing]: any = await db.query(
        `SELECT 'admin' AS origin_table, admin_email AS email, admin_phonenumber AS phone FROM admin WHERE admin_email = ? OR admin_phonenumber = ?
         UNION
         SELECT 'guide' AS origin_table, guides_email AS email, guides_phonenumber AS phone FROM guides WHERE (guides_email = ? OR guides_phonenumber = ?) AND guides_id != ?
         UNION
         SELECT 'customer' AS origin_table, cus_email AS email, cus_phonenumber AS phone FROM customers WHERE cus_email = ? OR cus_phonenumber = ?`,
        [
          guides_email, guides_phonenumber,         // ตาราง admin
          guides_email, guides_phonenumber, id,     // ตาราง guides (เช็กคนอื่น ยกเว้นตัวเอง)
          guides_email, guides_phonenumber          // ตาราง customers
        ]
      );

      if (existing.length > 0) {
        const isEmailDup = existing.some((row: any) => row.email === guides_email);
        const isPhoneDup = existing.some((row: any) => row.phone === guides_phonenumber);
        
        const matchedRole = existing[0].origin_table; 
        let roleThai = "ระบบ";
        if (matchedRole === "admin") roleThai = "แอดมิน";
        if (matchedRole === "guide") roleThai = "ไกด์ท่านอื่น";
        if (matchedRole === "customer") roleThai = "ลูกค้า";

        let alertMessage = "❌ ข้อมูลนี้ถูกใช้งานในระบบแล้ว";
        if (isEmailDup && isPhoneDup) {
          alertMessage = `❌ อีเมลและเบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
        } else if (isEmailDup) {
          alertMessage = `❌ อีเมลนี้ถูกใช้งานแล้วโดย (${roleThai})`;
        } else if (isPhoneDup) {
          alertMessage = `❌ เบอร์โทรศัพท์นี้ถูกใช้งานแล้วโดย (${roleThai})`;
        }

        //ส่งสเตตัส 409 เพื่อบอกหน้าบ้านว่าเกิด Conflict ข้อมูลซ้ำซ้อน
        return res.status(409).json({
          success: false,
          message: alertMessage,
        });
      }

      //PASSWORD PROCESS
      let password = old.guides_password;
      if (guides_password) {
        password = await bcrypt.hash(guides_password, 10);
      }

      // ================= FILE UPLOAD PROCESS =================
      let image = old.guides_imageprofile;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "guides/profile");
        image = result.secure_url;
      }

      // ================= SQL UPDATE =================
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
          guides_email,              
          password,
          guides_facebook, 
          guides_language, 
          image,
          id,
        ],
      );

      return res.json({
        success: true,
        message: "✅ อัปเดตโปรไฟล์ไกด์สำเร็จ",
      });

    } catch (err: any) {
      console.error("🔥 Update Guide Error:", err);
      return res.status(500).json({ 
        success: false,
        message: "❌ Server Error",
        error: err.message 
      });
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
      const { id } = req.params;
      const { guides_name, guides_phonenumber, guides_email, guides_facebook, guides_language } = req.body;

      // 1. ตรวจสอบข้อมูลเก่า
      const [rows]: any = await db.query("SELECT * FROM guides WHERE guides_id = ?", [id]);
      if (!rows.length) return res.status(404).json({ message: "ไม่พบข้อมูลไกด์ในระบบ" });
      const oldData = rows[0];

      // 2. คลีนค่าข้อมูล
      const email = guides_email ? guides_email.toLowerCase().trim() : "";
      const phoneNumber = guides_phonenumber ? guides_phonenumber.replace(/\D/g, "").trim() : ""; 

      // 3. ตรวจสอบข้อมูลซ้ำ (คงลอจิก CAST และ REPLACE ป้องกันบั๊กบน Render เหมือนเดิม)
      const [dup]: any = await db.query(
        `SELECT guides_id FROM guides 
         WHERE (LOWER(guides_email) = ? OR REPLACE(guides_phonenumber, '-', '') = ?) 
         AND CAST(guides_id AS CHAR) != CAST(? AS CHAR)`, 
        [email, phoneNumber, id]
      );
      if (dup.length) return res.status(400).json({ message: "อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });

      // 4. อัปโหลดรูปภาพใหม่ (ลดรูปฟังก์ชันเหลือบรรทัดเดียวสั้นๆ)
      const files = req.files as any;
      const upImg = async (f: any, p: string, old: string) => f?.[0]?.buffer ? (await uploadToCloudinary(f[0].buffer, p)).secure_url : old;

      const imgProfile = await upImg(files?.guides_imageprofile, "guides/profile", oldData.guides_imageprofile);
      const imgLicense = await upImg(files?.guides_imagelicense, "guides/licenses", oldData.guides_imagelicense);
      const imgBusiness = await upImg(files?.guides_image_business_license, "guides/business", oldData.guides_image_business_license);

      // 5. อัปเดตข้อมูลลง Database
      await db.query(
        `UPDATE guides SET 
          guides_name = ?, guides_phonenumber = ?, guides_email = ?, guides_facebook = ?, 
          guides_language = ?, guides_imageprofile = ?, guides_imagelicense = ?, 
          guides_image_business_license = ?, guides_status = 0
        WHERE guides_id = ?`,
        [guides_name, phoneNumber, email, guides_facebook, guides_language, imgProfile, imgLicense, imgBusiness, id]
      );

      return res.json({ success: true, message: "ส่งเอกสารแก้ไขเรียบร้อยแล้ว ระบบจะทำการตรวจสอบอีกครั้งภายใน 1-3 วันทำการค่ะ" });

    } catch (err: any) {
      console.error("Re-submit Error:", err);
      return res.status(500).json({ message: "Server Error", error: err.message });
    }
  }
);

router.delete("/profile/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    // 1. หา booking_queue_id ทั้งหมดของไกด์คนนี้
    const [bookings]: any = await db.query(
      "SELECT booking_queue_id FROM booking_queues WHERE ref_guid_id = ?",
      [id],
    );

    console.log("BOOKING COUNT =>", bookings.length);

    // หากไกด์คนนี้เคยมีประวัติการจอง ให้ตามไปเคลียร์ตารางรีวิวให้หมด
    if (bookings.length > 0) {
      for (const booking of bookings) {
        // 🔥 เพิ่มตรงนี้: ลบรีวิวสถานที่ท่องเที่ยวที่ผูกกับบุ๊กกิ้งนี้ก่อน
        await db.query("DELETE FROM review_locations WHERE booking_queue_id = ?", [
          booking.booking_queue_id,
        ]);

        // ลบรีวิวไกด์ (โค้ดเดิมของคุณ)
        await db.query("DELETE FROM review_guides WHERE booking_queue_id = ?", [
          booking.booking_queue_id,
        ]);
      }
    }

    // 2. ลบข้อมูลในตารางบุ๊กกิ้ง (เมื่อไม่มีรีวิวค้างแล้ว จะลบได้ฉลุย)
    await db.query("DELETE FROM booking_queues WHERE ref_guid_id = ?", [id]);

    // 3. ลบข้อมูลไกด์ออกจากตารางหลัก
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

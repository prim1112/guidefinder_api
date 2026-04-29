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

router.get("/guides/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    const [rows]: any = await db.query(
      "SELECT * FROM guides WHERE guides_id = ?",
      [gid]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูล",
      });
    }

    const guide = rows[0];

    // ❗ ตัด password ออก (best practice)
    const { guides_password, ...safeGuide } = guide;

    return res.json({
      message: "ดึงข้อมูลสำเร็จ",
      data: safeGuide,
    });

  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
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
        [guides_email, guides_phonenumber]
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
        (await uploadImage(files?.guides_imageprofile?.[0], "guides/profile")) ||
        "https://i.pinimg.com/564x/57/00/c0/5700c04197ee9a4372a35ef16eb78f4e.jpg";

      const guideLicenseUrl = await uploadImage(
        files?.guides_imagelicense?.[0],
        "guides/licenses"
      );

      const businessLicenseUrl = await uploadImage(
        files?.guides_image_business_license?.[0],
        "guides/business"
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
        ]
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
  }
);

router.post("/approve/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params; 
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1. ค้นหาในตาราง `guides` โดยใช้ Column `guides_id`
    const [rows]: any = await conn.query(
      "SELECT * FROM `guides` WHERE `guides_id` = ?", 
      [gid]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({
        message: `ไม่พบข้อมูลไกด์รหัส ${gid} ในระบบ`,
      });
    }

    // 2. อัปเดต guides_status เป็น 1 (อนุมัติ)
    // ใช้ชื่อตาราง `guides` ให้ตรงกับที่คุณแจ้งมา
    await conn.query(
      "UPDATE `guides` SET `guides_status` = 1 WHERE `guides_id` = ?",
      [gid]
    );

    await conn.commit();

    return res.json({
      message: "อนุมัติไกด์สำเร็จแล้ว",
      gid: gid
    });

  } catch (error: any) {
    if (conn) await conn.rollback();
    console.error("SQL Error:", error);
    return res.status(500).json({
      message: "Server Error",
      error: error.sqlMessage || error.message,
    });
  } finally {
    if (conn) conn.release();
  }
});

// reject  guide_pending 
router.delete("/reject/:gid", async (req: Request, res: Response) => {
  const { gid } = req.params;

  try {
    const [rows]: any = await db.query(
      `SELECT guides_name, guides_email, guides_phonenumber 
       FROM guide_pending 
       WHERE gid = ?`,
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
      message: "ปฏิเสธและลบข้อมูลเรียบร้อยแล้ว",
      deleted_data: guide,
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
      [id]
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
      "SELECT * FROM guides WHERE guides_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลไกด์",
      });
    }

    const guide = rows[0];

    // ✅ ลบ password ออกก่อนส่ง
    delete guide.guides_password;

    return res.json({
      message: "ดึงข้อมูลสำเร็จ",
      data: guide,
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
    const id = Number(req.params.id);

    try {
      const {
        guides_name,
        guides_phonenumber,
        guides_email,
        guides_password,
        confirm_password,
        guides_facebook,
        guides_language,
        guides_province,
      } = req.body;

      const [rows]: any = await db.query(
        "SELECT * FROM guides WHERE guides_id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "ไม่พบไกด์",
        });
      }

      const guide = rows[0];

      // ================= PASSWORD =================
      let hashedPassword = guide.guides_password;

      if (guides_password) {
        if (guides_password !== confirm_password) {
          return res.status(400).json({
            message: "รหัสผ่านไม่ตรงกัน",
          });
        }

        hashedPassword = await bcrypt.hash(guides_password, 10);
      }

      // ================= IMAGE =================
      let imageUrl = guide.guides_imageprofile;

      if (req.file) {
        const result = await uploadToCloudinary(
          req.file.buffer,
          "guides/profile"
        );
        imageUrl = result.secure_url;
      }

      // ================= UPDATE =================
      await db.query(
        `UPDATE guides SET 
          guides_name = ?,
          guides_phonenumber = ?,
          guides_email = ?,
          guides_password = ?,
          guides_facebook = ?,
          guides_language = ?,
          guides_province = ?,
          guides_imageprofile = ?
        WHERE guides_id = ?`,
        [
          guides_name ?? guide.guides_name,
          guides_phonenumber ?? guide.guides_phonenumber,
          guides_email ?? guide.guides_email,
          hashedPassword,
          guides_facebook ?? guide.guides_facebook,
          guides_language ?? guide.guides_language,
          guides_province ?? guide.guides_province,
          imageUrl,
          id,
        ]
      );

      return res.json({
        message: "อัปเดตโปรไฟล์สำเร็จ",
      });

    } catch (error: any) {
      return res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
);

//  DELETE GUIDE PROFILE
router.delete("/profile/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const [result]: any = await db.query(
      "DELETE FROM guides WHERE guides_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "ไม่พบไกด์",
      });
    }

    return res.json({
      message: "ลบบัญชีสำเร็จ",
    });

  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

export default router;
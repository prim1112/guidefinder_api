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
router.post("/login_guide", async (req: Request, res: Response) => {
  const { guides_email, guides_password } = req.body;

  try {
    const [rows]: any = await db.query(
      "SELECT * FROM guides WHERE guides_email = ?",
      [guides_email]
    );

    if (!rows.length) {
      return res.status(400).json({
        message: "ไม่พบบัญชี",
      });
    }

    const guide = rows[0];

    // 🔥 เช็ค status ก่อน
    if (guide.guides_status === 0) {
      return res.status(403).json({
        message: "บัญชีของคุณกำลังรอการอนุมัติจากแอดมิน",
      });
    }

    if (guide.guides_status === 2) {
      return res.status(403).json({
        message: "บัญชีของคุณถูกปฏิเสธ",
      });
    }

    // 🔐 เช็ครหัสผ่าน
    const isMatch = await bcrypt.compare(
      guides_password,
      guide.guides_password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "รหัสผ่านไม่ถูกต้อง",
      });
    }

    return res.status(200).json({
      message: "เข้าสู่ระบบสำเร็จ",
      guide,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
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

export default router;
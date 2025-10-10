import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt"; // ✅ เพิ่ม bcrypt
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ ฟังก์ชันอัปโหลดภาพขึ้น Cloudinary
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

// ✅ ทดสอบ Cloudinary
router.get("/test-cloudinary", (req, res) => {
  res.json({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
    api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
  });
});

// ✅ ดึงข้อมูลลูกค้าทั้งหมด
router.get("/customers", (req: Request, res: Response) => {
  const sql = "SELECT * FROM customer";

  db.query(sql, (err: any, rows: any[]) => {
    if (err) return handleResponse(res, err);

    const sanitizedRows = rows.map((row) => {
      const { password, ...sanitized } = row;
      return sanitized;
    });

    handleResponse(res, null, sanitizedRows);
  });
});

// ✅ ตรวจสอบเบอร์โทรซ้ำ
router.post("/customers_check-phone", async (req: Request, res: Response) => {
  const { phone } = req.body;

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT cid FROM customer WHERE phone = ?",
    [phone]
  );

  if (rows.length > 0) {
    return res.status(400).json({ message: "❌ เบอร์โทรนี้ถูกใช้งานแล้ว" });
  }

  res.json({ message: "✅ ใช้เบอร์นี้ได้" });
});

// ✅ Register (แก้ไขตรงนี้ให้เข้ารหัสรหัสผ่าน)
router.post(
  "/customers",
  upload.single("image_customer"),
  async (req: Request, res: Response) => {
    const { name, phone, email, password } = req.body;
    let imageUrl = "";

    try {
      // ดักเบอร์ซ้ำ
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT cid FROM customer WHERE phone = ?",
        [phone]
      );
      if (rows.length > 0) {
        return res
          .status(400)
          .json({ message: "❌ เบอร์โทรนี้มีอยู่ในระบบแล้ว" });
      }

      // ✅ เข้ารหัสรหัสผ่านก่อนบันทึก
      const hashedPassword = await bcrypt.hash(password, 10);

      // ✅ อัปโหลดรูป (เฉพาะถ้าไม่ซ้ำ)
      if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      // ✅ บันทึกลงฐานข้อมูล
      const [insertResult] = await db.execute<ResultSetHeader>(
        "INSERT INTO customer (name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?)",
        [name, phone, email, imageUrl, hashedPassword]
      );

      res.json({
        message: "✅ Register successfully",
        id: insertResult.insertId,
      });
    } catch (err: any) {
      console.error("Error in register:", err);
      res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
  }
);

// ✅ Login (ตรวจสอบรหัสผ่านที่ถูกเข้ารหัส)
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // ✅ ตรวจว่ากรอกครบไหม
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอก Email และ Password" });
    }

    // ✅ ค้นหาผู้ใช้จาก Email
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customer WHERE email = ?",
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
    }

    // ✅ ตรวจสอบรหัสผ่าน
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
    }

    // ✅ สำเร็จ → ส่งข้อมูลกลับ (ไม่ส่งรหัสผ่าน)
    res.json({
      message: "✅ Login สำเร็จ",
      user: {
        cid: user.cid,
        name: user.name,
        phone: user.phone,
        email: user.email,
        image_customer: user.image_customer,
      },
    });
  } catch (err: any) {
    console.error("Error in login:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

// ✅ Helper ฟังก์ชันตอบกลับ API
export function handleResponse(
  res: Response,
  err: Error | null,
  data?: any,
  notFoundStatusCode: number = 404,
  notFoundMessage: string = "Not found",
  affectedRows: number | null = null
): void {
  if (err) {
    res.status(500).json({ error: err.message });
    return;
  }
  if (!data && !affectedRows) {
    res.status(notFoundStatusCode).json({ error: notFoundMessage });
    return;
  }
  res.json(data);
}

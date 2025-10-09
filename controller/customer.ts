import { Request, Response, Router, NextFunction } from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../src/config/configCloud";
// import uploadToCloud from "../src/config/uploadToCloudinary";
import db from "../db/dbconnect";
import { ResultSetHeader } from "mysql2";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
// ✅ Middleware เช็กเบอร์ก่อน upload
const checkDuplicatePhone = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "❌ กรุณาระบุหมายเลขโทรศัพท์" });
    }

    const [rows] = await db.execute<any[]>(
      "SELECT cid FROM customer WHERE phone = ?",
      [phone]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: "❌ เบอร์โทรนี้ถูกใช้งานแล้ว" });
    }

    next(); // ✅ ผ่าน -> ไป upload รูป
  } catch (error) {
    console.error("❌ Phone check error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ เรียงลำดับ middleware ให้ถูก
router.post(
  "/customers",
  checkDuplicatePhone, // ⬅️ เช็กก่อน
  upload.single("image_customer"), // ⬅️ แล้วค่อย upload
  async (req: Request, res: Response) => {
    try {
      const { name, phone, email, password } = req.body;
      let imageUrl = "";

      if (req.file && req.file.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      const sql =
        "INSERT INTO customer (`name`, `phone`, `email`, `image_customer`, `password`) VALUES (?, ?, ?, ?, ?)";
      const [result] = await db.execute<ResultSetHeader>(sql, [
        name,
        phone,
        email,
        imageUrl,
        password,
      ]);

      res.json({
        message: "✅ Customer created successfully",
        id: (result as ResultSetHeader).insertId,
      });
    } catch (error: any) {
      console.error("❌ Insert Error:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  }
);
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

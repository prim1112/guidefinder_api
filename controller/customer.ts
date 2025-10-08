import { Request, Response, Router } from "express";
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

// ✅ เพิ่มลูกค้าใหม่ (อัปโหลดรูปขึ้น Cloudinary)
router.post(
  "/customers",
  upload.single("image_customer"),
  async (req: Request, res: Response) => {
    try {
      const { name, phone, email, password } = req.body;
      let imageUrl = "";

      if (req.file && req.file.buffer) {
        // const result = await uploadToCloud(req.file.buffer, "customers");
        const result = await uploadToCloudinary(req.file.buffer, "customers");

        imageUrl = result.secure_url;
      }

      const sql =
        "INSERT INTO customer (`name`, `phone`, `email`, `image_customer`, `password`) VALUES (?, ?, ?, ?, ?)";
      console.log("📦 SQL:", sql);
      console.log("📊 VALUES:", [name, phone, email, imageUrl, password]);

      // ✅ ใช้ execute แทน query (เพราะ db เป็น mysql2/promise)
      const [result] = await db.execute<ResultSetHeader>(sql, [
        name,
        phone,
        email,
        imageUrl,
        password,
      ]);

      handleResponse(res, null, {
        message: "✅ Customer created successfully",
        id: (result as ResultSetHeader).insertId,
      });
    } catch (error: any) {
      console.error("❌ SQL Insert Error:", error);
      res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  }
);

// Helper function to handle API responses
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

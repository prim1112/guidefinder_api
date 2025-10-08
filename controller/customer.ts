import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../src/config/configCloud";
import uploadToCloud from "../src/config/uploadToCloudinary";
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
      const { cid, name, phone, email, password } = req.body;
      let imageUrl = "";

      if (req.file && req.file.buffer) {
        const result = await uploadToCloud(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      const sql =
        "INSERT INTO customer (cid, name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?, ?)";

      // 🟢 เพิ่ม <ResultSetHeader> เพื่อให้ TypeScript รู้ว่ามี insertId
      db.query<ResultSetHeader>(
        sql,
        [cid, name, phone, email, imageUrl, password],
        (err, result) => {
          if (err)
            return handleResponse(
              res,
              err,
              null,
              500,
              "Failed to create customer"
            );

          handleResponse(res, null, {
            message: "✅ Customer created successfully",
            id: result.insertId, // ✅ ใช้ได้แล้ว ไม่มี error
          });
        }
      );
    } catch (error: any) {
      console.error("❌ Upload Error:", error);
      res.status(500).json({ message: "Upload failed", error: error.message });
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

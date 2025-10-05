import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../src/config/configCloud";
import db from "../db/dbconnect";

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
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      const sql =
        "INSERT INTO customer (cid, name, phone, email, image_customer, password) VALUES (?, ?, ?, ?, ?, ?)";

      db.query(
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
            id: result.insertId,
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

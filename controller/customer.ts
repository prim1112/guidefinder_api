import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import cloudinary from "../src/config/configCloud";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.get("/test-cloudinary", (req, res) => {
  res.json({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
    api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
  });
});

interface ReviewRequestBody {
  booking_queue_id: number | string;
  attraction_rating: number;
  attraction_comment?: string;
  guide_rating: number;
  guide_comment?: string;
}

// 🔍 GET ALL CUSTOMERS
router.get("/customers", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT cus_id, cus_name, cus_email, cus_phonenumber, cus_imageprofile 
      FROM customers
    `);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 🔍 GET PROFILE
router.get("/profile/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows]: any = await db.query(
      `SELECT cus_id, cus_name, cus_email, cus_phonenumber, cus_imageprofile 
       FROM customers WHERE cus_id = ?`,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 📝 REGISTER
router.post(
  "/register",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    try {
      const { cus_name, cus_phonenumber, cus_email, cus_password } = req.body;

      if (!cus_email || !cus_password || !cus_phonenumber) {
        return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ" });
      }

      const email = cus_email.toLowerCase();

      // check email/phone
      const [dup]: any = await db.query(
        `SELECT cus_id FROM customers 
         WHERE cus_email = ? OR cus_phonenumber = ?`,
        [email, cus_phonenumber],
      );

      if (dup.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์ถูกใช้งานแล้ว",
        });
      }

      const hashed = await bcrypt.hash(cus_password, 10);

      let imageUrl = null;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      const [result]: any = await db.query(
        `INSERT INTO customers 
        (cus_name, cus_phonenumber, cus_email, cus_password, cus_imageprofile)
        VALUES (?, ?, ?, ?, ?)`,
        [cus_name, cus_phonenumber, email, hashed, imageUrl],
      );

      res.status(201).json({
        success: true,
        cus_id: result.insertId,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ✏️ UPDATE PROFILE
router.put(
  "/profile/:id",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const {
        cus_name,
        cus_phonenumber,
        cus_email,
        cus_password,
        confirm_password,
      } = req.body;

      const [rows]: any = await db.query(
        "SELECT * FROM customers WHERE cus_id = ?",
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }

      const old = rows[0];

      // password check
      if (cus_password && cus_password !== confirm_password) {
        return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
      }

      const email = cus_email ? cus_email.toLowerCase() : old.cus_email;

      // check duplicate
      const [dup]: any = await db.query(
        `SELECT cus_id FROM customers 
         WHERE (cus_email = ? OR cus_phonenumber = ?) AND cus_id != ?`,
        [email, cus_phonenumber || old.cus_phonenumber, id],
      );

      if (dup.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์ถูกใช้งานแล้ว",
        });
      }

      // password
      let password = old.cus_password;
      if (cus_password) {
        password = await bcrypt.hash(cus_password, 10);
      }

      // image
      let image = old.cus_imageprofile;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        image = result.secure_url;
      }

      await db.query(
        `UPDATE customers SET 
          cus_name = ?, 
          cus_phonenumber = ?, 
          cus_email = ?, 
          cus_password = ?, 
          cus_imageprofile = ? 
        WHERE cus_id = ?`,
        [
          cus_name || old.cus_name,
          cus_phonenumber || old.cus_phonenumber,
          email,
          password,
          image,
          id,
        ],
      );

      res.json({
        success: true,
        message: "อัปเดตสำเร็จ",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ❌ DELETE
router.delete("/profile/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows]: any = await db.query(
      "SELECT cus_id FROM customers WHERE cus_id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    await db.query("DELETE FROM customers WHERE cus_id = ?", [id]);

    res.json({ success: true, message: "ลบสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

//  FAVORITE PLACE
// เพิ่มสถานที่โปรด
router.post("/favorite/add", async (req: Request, res: Response) => {
  try {
    const { cus_id, location_id } = req.body;

    // ตรวจสอบข้อมูล
    if (!cus_id || !location_id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุข้อมูลให้ครบ",
      });
    }

    // เช็คว่ามี favorite นี้แล้วหรือยัง
    const [check]: any = await db.query(
      `
        SELECT * FROM favorite_places
        WHERE cus_id = ? AND location_id = ?
        `,
      [cus_id, location_id],
    );

    if (check.length > 0) {
      return res.status(400).json({
        success: false,
        message: "สถานที่นี้อยู่ในรายการโปรดแล้ว",
      });
    }

    // เพิ่ม favorite
    const [result] = await db.query<ResultSetHeader>(
      `
        INSERT INTO favorite_places
        (cus_id, location_id)
        VALUES (?, ?)
        `,
      [cus_id, location_id],
    );

    res.status(201).json({
      success: true,
      message: "เพิ่มรายการโปรดสำเร็จ",
      favorite_id: result.insertId,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ดึงรายการ favorite ของ customer และเรียงตาม ก-ฮ (A-Z)
router.get("/favorite/:cus_id", async (req: Request, res: Response) => {
  try {
    const cus_id = Number(req.params.cus_id);

    const [rows]: any = await db.query(
      `
      SELECT
        fp.favorite_id,
        fp.location_id,
        l.travel_name,
        l.travel_image,
        l.travel_detail
      FROM favorite_places fp
      LEFT JOIN location_travel l ON fp.location_id = l.id
      WHERE fp.cus_id = ?
      ORDER BY l.travel_name ASC; -- เปลี่ยนตรงนี้เพื่อเรียงจาก ก-ฮ (A-Z)
      `,
      [cus_id],
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

//  ลบ favorite
router.delete(
  "/favorite/delete/:favorite_id",
  async (req: Request, res: Response) => {
    try {
      const favorite_id = Number(req.params.favorite_id);

      const [check]: any = await db.query(
        `SELECT * FROM favorite_places WHERE favorite_id = ?`,
        [favorite_id],
      );

      if (!check.length) {
        return res.status(404).json({
          success: false,
          message: "ไม่พบรายการโปรด",
        });
      }

      await db.query(`DELETE FROM favorite_places WHERE favorite_id = ?`, [
        favorite_id,
      ]);

      res.json({
        success: true,
        message: "ลบรายการโปรดสำเร็จ",
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  },
);


router.post('/reviews', async (req: Request<{}, {}, ReviewRequestBody>, res: Response) => {
  try {
    // ดึงค่าออกมาจาก req.body
    const { 
      booking_queue_id, 
      attraction_rating, 
      attraction_comment, 
      guide_rating, 
      guide_comment 
    } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น (Validation)
    if (!booking_queue_id || !attraction_rating || !guide_rating) {
      return res.status(400).json({ 
        success: false, 
        message: "กรุณาระบุ booking_queue_id และคะแนนดาวให้ครบถ้วน" 
      });
    }

    // คำสั่ง SQL สำหรับบันทึกลงตาราง reviews
    const sql = `INSERT INTO reviews 
                (booking_queue_id, attraction_rating, attraction_comment, guide_rating, guide_comment) 
                VALUES (?, ?, ?, ?, ?)`;

    const values = [
      booking_queue_id, 
      attraction_rating, 
      attraction_comment || null, // ถ้าไม่ได้พิมพ์มา ให้ส่งเป็น null ลงฐานข้อมูล
      guide_rating, 
      guide_comment || null
    ];

    // สั่งรันคำสั่ง SQL ลงฐานข้อมูลด้วยแบบ async/await ตามสไตล์ของระบบลูกค้า
    const [result]: any = await db.query(sql, values);
    
    // ส่งข้อความกลับไปบอกแอป Flutter
    res.status(201).json({ 
      success: true, 
      message: "บันทึกรีวิวเรียบร้อยแล้ว ขอบคุณครับ!",
      reviews_id: result.insertId // แนบไอดีรีวิวที่เพิ่งสร้างกลับไปด้วย (ถ้าต้องการใช้)
    });

  } catch (error: any) {
    console.error("Database Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดภายในระบบฐานข้อมูล",
      error: error.message 
    });
  }
});

// // ✅ Login (ตรวจสอบรหัสผ่านที่ถูกเข้ารหัส)
// router.post("/login", async (req: Request, res: Response) => {
//   const { email, password } = req.body;
//   try {
//     // ✅ ตรวจว่ากรอกครบไหม
//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "❌ กรุณากรอก Email และ Password" });
//     }
//     // ✅ ค้นหาผู้ใช้จาก Email
//     const [rows] = await db.execute<RowDataPacket[]>(
//       "SELECT * FROM customer WHERE email = ?",
//       [email],
//     );
//     const user = rows[0];
//     if (!user) {
//       return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
//     }

//     // ✅ ตรวจสอบรหัสผ่าน
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
//     }

//     // ✅ สำเร็จ → ส่งข้อมูลกลับ (ไม่ส่งรหัสผ่าน)
//     res.json({
//       message: "✅ Login สำเร็จ",
//       user: {
//         cid: user.cid,
//         name: user.name,
//         phone: user.phone,
//         email: user.email,
//         image_customer: user.image_customer,
//       },
//     });
//   } catch (err: any) {
//     console.error("Error in login:", err);
//     res.status(500).json({ message: "❌ Server Error", error: err.message });
//   }
// });

// ✅ Helper ฟังก์ชันตอบกลับ API
export function handleResponse(
  res: Response,
  err: Error | null,
  data?: any,
  notFoundStatusCode: number = 404,
  notFoundMessage: string = "Not found",
  affectedRows: number | null = null,
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

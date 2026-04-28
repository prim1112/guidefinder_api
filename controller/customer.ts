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

// get all customers
router.get("/customers/:id", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM customers");

    const customers = rows.map(({ password, ...rest }: any) => rest);

    return res.json({
      message: "ดึงข้อมูล Customers สำเร็จ",
      count: customers.length,
      data: customers,
    });
  } catch (error: any) {
    console.error("GET /customers error:", error);

    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});


// register customers
router.post("/register_customers",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    const { cus_name, cus_phonenumber, cus_email, cus_password } = req.body;

    try {
      // validate
      if (!cus_email || !cus_password || !cus_phonenumber) {
        return res.status(400).json({
          message: "กรุณากรอก email, password และเบอร์โทร",
        });
      }

      const email = cus_email.toLowerCase();

      // check phone 
      const [phoneRows]: any = await db.query(
        "SELECT cus_phonenumber FROM customers WHERE cus_phonenumber = ?",
        [cus_phonenumber]
      );

      if (phoneRows.length) {
        return res.status(400).json({
          message: "เบอร์โทรนี้มีอยู่ในระบบแล้ว",
        });
      }

      // check email
      const [emailRows]: any = await db.query(
        "SELECT cus_email FROM customers WHERE cus_email = ?",
        [email]
      );

      if (emailRows.length) {
        return res.status(400).json({
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        });
      }

      //hash password
      const hashedPassword = await bcrypt.hash(cus_password, 10);

      // upload image
      let cus_imageprofile: string | null = null;

      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        cus_imageprofile = result.secure_url;
      }

      //insert
      const [result]: any = await db.query(
        `INSERT INTO customers 
        (cus_name, cus_phonenumber, cus_email, cus_password, cus_imageprofile)
        VALUES (?, ?, ?, ?, ?)`,
        [
          cus_name || null,
          cus_phonenumber,
          email,
          hashedPassword,
          cus_imageprofile,
        ]
      );

      return res.status(201).json({
        message: "สมัครสมาชิกสำเร็จ",
        cid: result.insertId,
      });
    } catch (error: any) {
      console.error("POST /register_customers error:", error);

      return res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const [rows]: any = await db.query(
      "SELECT * FROM customers WHERE cus_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบลูกค้า",
      });
    }

    const user = rows[0];

    // 🔐 เช็ครหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.cus_password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "รหัสผ่านไม่ถูกต้อง",
      });
    }

    await db.query("DELETE FROM customers WHERE cus_id = ?", [id]);

    return res.json({
      success: true,
      message: "ลบบัญชีสำเร็จ",
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

router.put(
  "/customers/:id",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { cus_name, cus_phonenumber, cus_email, cus_password } = req.body;

    try {
      // 🔍 เช็คว่ามี user จริงไหม
      const [userRows]: any = await db.query(
        "SELECT * FROM customers WHERE cus_id = ?",
        [id]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          message: "ไม่พบลูกค้า",
        });
      }

      const currentUser = userRows[0];

      // 🔐 check email ซ้ำ (ถ้ามีการเปลี่ยน)
      if (cus_email && cus_email !== currentUser.cus_email) {
        const [emailRows]: any = await db.query(
          "SELECT cus_id FROM customers WHERE cus_email = ?",
          [cus_email.toLowerCase()]
        );

        if (emailRows.length) {
          return res.status(400).json({
            message: "อีเมลนี้ถูกใช้งานแล้ว",
          });
        }
      }

      // 📱 check phone ซ้ำ
      if (cus_phonenumber && cus_phonenumber !== currentUser.cus_phonenumber) {
        const [phoneRows]: any = await db.query(
          "SELECT cus_id FROM customers WHERE cus_phonenumber = ?",
          [cus_phonenumber]
        );

        if (phoneRows.length) {
          return res.status(400).json({
            message: "เบอร์โทรนี้มีอยู่ในระบบแล้ว",
          });
        }
      }

      // 🔐 hash password (ถ้ามีการเปลี่ยน)
      let hashedPassword = currentUser.cus_password;
      if (cus_password) {
        hashedPassword = await bcrypt.hash(cus_password, 10);
      }

      // 🖼️ อัปโหลดรูป (ถ้ามี)
      let imageUrl = currentUser.cus_imageprofile;

      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      // 🧠 update แบบ safe (ไม่ส่ง = ใช้ค่าเดิม)
      await db.query(
        `UPDATE customers SET 
          cus_name = ?, 
          cus_phonenumber = ?, 
          cus_email = ?, 
          cus_password = ?, 
          cus_imageprofile = ?
        WHERE cus_id = ?`,
        [
          cus_name ?? currentUser.cus_name,
          cus_phonenumber ?? currentUser.cus_phonenumber,
          cus_email ? cus_email.toLowerCase() : currentUser.cus_email,
          hashedPassword,
          imageUrl,
          id,
        ]
      );

      return res.json({
        message: "อัปเดตข้อมูลสำเร็จ",
      });

    } catch (error: any) {
      console.error("PUT /customers/:id error:", error);

      return res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
);

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
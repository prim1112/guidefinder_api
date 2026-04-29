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
router.get("/customers", async (req: Request, res: Response) => {
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
router.post(
  "/register_customers",
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
  const id = Number(req.params.id);

  try {
    // 1. ดึงข้อมูลลูกค้าออกมาก่อนเพื่อเก็บไว้ส่งกลับไปยืนยัน (Optional but helpful)
    const [customer]: any = await db.query(
      "SELECT cus_id, cus_name, cus_email FROM customers WHERE cus_id = ?",
      [id]
    );

    if (customer.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลลูกค้าที่ต้องการลบ",
      });
    }

    // 2. ทำการลบข้อมูล
    const [result]: any = await db.query(
      "DELETE FROM customers WHERE cus_id = ?",
      [id]
    );

    // 3. ส่ง Response กลับไปพร้อมข้อมูลที่เพิ่งลบไป
    return res.json({
      success: true,
      message: "ลบข้อมูลลูกค้าสำเร็จ",
      deletedData: {
        id: customer[0].cus_id,
        name: customer[0].cus_name,
        email: customer[0].cus_email
      }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดที่ระบบ Server",
      error: error.message,
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
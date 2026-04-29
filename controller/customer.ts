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

router.put(
  "/:id",
  upload.single("cus_imageprofile"), 
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const {
      cus_name,
      cus_phonenumber,
      cus_email,
      cus_password,
      confirm_password,
    } = req.body;

    try {
      // 🔹 1. check user
      const [customers]: any = await db.query(
        "SELECT * FROM customers WHERE cus_id = ?",
        [id]
      );

      if (customers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "ไม่พบข้อมูลลูกค้า",
        });
      }

      const oldData = customers[0];

      // 🔹 2. validate password
      if (cus_password && cus_password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message: "รหัสผ่านไม่ตรงกัน",
        });
      }

      const email = cus_email ? cus_email.toLowerCase() : oldData.cus_email;

      // 🔹 3. check phone ซ้ำ
      if (cus_phonenumber && cus_phonenumber !== oldData.cus_phonenumber) {
        const [phoneRows]: any = await db.query(
          "SELECT cus_phonenumber FROM customers WHERE cus_phonenumber = ?",
          [cus_phonenumber]
        );

        if (phoneRows.length) {
          return res.status(400).json({
            success: false,
            message: "เบอร์นี้ถูกใช้งานแล้ว",
          });
        }
      }

      // 🔹 4. check email ซ้ำ
      if (cus_email && cus_email !== oldData.cus_email) {
        const [emailRows]: any = await db.query(
          "SELECT cus_email FROM customers WHERE cus_email = ?",
          [email]
        );

        if (emailRows.length) {
          return res.status(400).json({
            success: false,
            message: "อีเมลนี้ถูกใช้งานแล้ว",
          });
        }
      }

      // 🔹 5. hash password
      let hashedPassword = oldData.cus_password;
      if (cus_password) {
        hashedPassword = await bcrypt.hash(cus_password, 10);
      }

      // 🔹 6. upload image (เหมือน register)
      let imageUrl = oldData.cus_imageprofile;

      if (req.file?.buffer) {
        const result = await uploadToCloudinary(
          req.file.buffer,
          "customers"
        );
        imageUrl = result.secure_url;
      }

      // 🔹 7. update db
      const updatedValues = {
        cus_name: cus_name || oldData.cus_name,
        cus_phonenumber:
          cus_phonenumber || oldData.cus_phonenumber,
        cus_email: email,
        cus_password: hashedPassword,
        cus_imageprofile: imageUrl,
      };

      await db.query(
        `UPDATE customers SET 
          cus_name = ?, 
          cus_phonenumber = ?, 
          cus_email = ?, 
          cus_password = ?, 
          cus_imageprofile = ? 
        WHERE cus_id = ?`,
        [
          updatedValues.cus_name,
          updatedValues.cus_phonenumber,
          updatedValues.cus_email,
          updatedValues.cus_password,
          updatedValues.cus_imageprofile,
          id,
        ]
      );

      // 🔹 8. response
      return res.json({
        success: true,
        message: "อัปเดตสำเร็จ",
        data: {
          cus_id: id,
          cus_name: updatedValues.cus_name,
          cus_phonenumber: updatedValues.cus_phonenumber,
          cus_email: updatedValues.cus_email,
          cus_imageprofile: updatedValues.cus_imageprofile,
        },
      });

    } catch (error: any) {
      console.error("PUT Error:", error);
      return res.status(500).json({
        success: false,
        message: "เกิดข้อผิดพลาด",
        error: error.message,
      });
    }
  }
);
router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const [rows]: any = await db.query(
      `SELECT cus_id, cus_name, cus_phonenumber, cus_email, cus_imageprofile 
       FROM customers 
       WHERE cus_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลลูกค้า",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ใช้เส้นทาง /me หรือ /profile-delete เพื่อสื่อความหมายว่า "จัดการตัวเอง"
router.delete("/me", async (req: Request, res: Response) => {
  
  // ปกติแล้ว id จะได้มาจาก Middleware ตรวจสอบ Token (เช่น req.user.id)
  // ในที่นี้สมมติว่าคุณเก็บ id ไว้ที่ req.user_id นะครับ
  const myId = (req as any).user_id; 

  if (!myId) {
    return res.status(401).json({
      success: false,
      message: "กรุณาล็อกอินก่อนทำรายการ"
    });
  }

  try {
    // 1. ดึงข้อมูลตัวเองมาเก็บไว้ก่อนลบ เพื่อส่งกลับไปบอกลาลูกค้า
    const [customer]: any = await db.query(
      "SELECT cus_name, cus_email FROM customers WHERE cus_id = ?",
      [myId]
    );

    if (customer.length === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลบัญชีของคุณ",
      });
    }

    // 2. ลบข้อมูลของตัวเองออกจากระบบ
    await db.query("DELETE FROM customers WHERE cus_id = ?", [myId]);

    // 3. ส่งคำยืนยันการลบ
    return res.json({
      success: true,
      message: "บัญชีของคุณถูกลบเรียบร้อยแล้ว เราหวังว่าจะได้บริการคุณใหม่ในโอกาสหน้า",
      details: {
        name: customer[0].cus_name,
        email: customer[0].cus_email,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "ไม่สามารถลบบัญชีได้ในขณะนี้",
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
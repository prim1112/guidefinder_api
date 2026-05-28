import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";
import crypto from "crypto";

export const router = Router();

// helper เช็ค password (รองรับ hash + plain)
async function checkPassword(input: string, stored: string) {
  if (stored.startsWith("$2b$")) {
    return await bcrypt.compare(input, stored);
  }
  return input === stored;
}

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "❌ กรุณากรอก Email และ Password",
      });
    }

    // 1. CUSTOMER
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email],
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;

      const isValid = await bcrypt.compare(password, user.cus_password);

      if (!isValid) {
        return res.status(401).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

      return res.json({
        message: "✅ Login สำเร็จ (Customer)",
        role: "customers",
        user: {
          id: user.cus_id,
          name: user.cus_name,
          email: user.cus_email,
          image: user.cus_imageprofile,
        },
      });
    }

    // 2. GUIDE
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email],
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as any;

      if (guide.guides_status === 0) {
        return res.status(403).json({
          message: "⏳ บัญชีรออนุมัติจากแอดมิน",
        });
      }

      if (guide.guides_status === 2) {
        return res.status(403).json({
          message: "❌ บัญชีถูกปฏิเสธ",
        });
      }

      const isValid = await bcrypt.compare(password, guide.guides_password);

      if (!isValid) {
        return res.status(401).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

      return res.json({
        message: "✅ Login สำเร็จ (Guide)",
        role: "guide",
        user: {
          id: guide.guides_id,
          name: guide.guides_name,
          email: guide.guides_email,
          image: guide.guides_imageprofile,
        },
      });
    }

    // 3. ADMIN

    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ? LIMIT 1",
      [email],
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      const isValid = await checkPassword(password, admin.admin_password);

      if (!isValid) {
        return res.status(401).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

      return res.json({
        message: `✅ Login สำเร็จ (${admin.admin_role})`,
        role: admin.admin_role, // ✅ ส่ง 'admin' หรือ 'superadmin' ตาม DB
        user: {
          id: admin.admin_id,
          name: admin.admin_name,
          email: admin.admin_email,
        },
      });
    }

    return res.status(404).json({
      message: "❌ ไม่พบบัญชีนี้",
    });
  } catch (err: any) {
    console.error("Login Error:", err);

    return res.status(500).json({
      message: "❌ Server Error",
    });
  }
});


// หน้าที่ 1: FORGOT PASSWORD
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "กรุณากรอกอีเมล" });
    }

    // 🔎 ค้นหาข้อมูลจากตารางลูกค้า โดยกำหนดค่าผลลัพธ์เป็น [any] เพื่อเคลียร์ปัญหาเส้นแดง
    const [customerRows]: any = await db.execute(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email]
    );
    
    // 🔎 ค้นหาข้อมูลจากตารางไกด์
    const [guideRows]: any = await db.execute(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email]
    );

    // เช็กว่ามีข้อมูลในระบบไหม (ใช้ .length ได้ปกติแล้ว ไม่แดงแน่นอน)
    if (!customerRows || !guideRows || (customerRows.length === 0 && guideRows.length === 0)) {
      return res.status(404).json({ message: "ไม่พบบัญชีที่ใช้งานอีเมลนี้ในระบบ" });
    }

    // 🔐 สร้างรหัส PIN 6 หลัก
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // ฟอร์แมตเวลาให้เข้ากับตาราง MySQL (YYYY-MM-DD HH:mm:ss)
    const expireDate = new Date(Date.now() + 1000 * 60 * 15); // อายุ 15 นาที
    const expireAt = expireDate.toISOString().slice(0, 19).replace('T', ' ');

    // 💾 บันทึกลงตาราง reset_password ตามคอลัมน์จริงในรูปของคุณ
    if (customerRows && customerRows.length > 0) {
      const customerId = customerRows[0].cus_id;
      await db.execute(
        `INSERT INTO reset_password (ref_user_id, reset_code, user_type, expire_at, is_used) VALUES (?, ?, 'customer', ?, 0)`,
        [customerId, resetCode, expireAt]
      );
    }

    if (guideRows && guideRows.length > 0) {
      const guideId = guideRows[0].guides_id;
      await db.execute(
        `INSERT INTO reset_password (ref_user_id, reset_code, user_type, expire_at, is_used) VALUES (?, ?, 'guide', ?, 0)`,
        [guideId, resetCode, expireAt]
      );
    }

    return res.json({
      message: "สร้างรหัส PIN รีเซ็ตสำเร็จ",
      resetCode, 
    });
  } catch (err) {
    console.error("เกิดข้อผิดพลาดใน forgot-password:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// หน้าที่ 2: VERIFY PIN
router.post("/verify-pin", async (req: Request, res: Response) => {
  const { code } = req.body;

  try {
    if (!code) {
      return res.status(400).json({ message: "กรุณากรอกรหัส PIN" });
    }

    const [rows]: any = await db.execute(
      "SELECT * FROM reset_password WHERE reset_code = ? AND is_used = 0",
      [code]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้อง หรือถูกใช้งานไปแล้ว" });
    }

    const reset = rows[0];
    if (new Date(reset.expire_at) < new Date()) {
      return res.status(400).json({ message: "PIN นี้หมดอายุแล้ว" });
    }

    return res.json({
      message: "PIN ถูกต้อง ยินยอมให้เปลี่ยนรหัสผ่านได้",
      code,
    });
  } catch (err) {
    console.error("เกิดข้อผิดพลาดใน verify-pin:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// หน้าที่ 3: RESET PASSWORD
router.post("/reset-password", async (req: Request, res: Response) => {
  const { code, newPassword } = req.body;

  try {
    if (!code || !newPassword) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    const [rows]: any = await db.execute(
      "SELECT * FROM reset_password WHERE reset_code = ? AND is_used = 0",
      [code]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้อง หรือหมดอายุการใช้งานแล้ว" });
    }

    if (new Date(rows[0].expire_at) < new Date()) {
      return res.status(400).json({ message: "PIN หมดอายุแล้ว" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    for (const reset of rows) {
      if (reset.user_type === "customer") {
        await db.execute(
          "UPDATE customers SET cus_password = ? WHERE cus_id = ?",
          [hashed, reset.ref_user_id]
        );
      } else if (reset.user_type === "guide") {
        await db.execute(
          "UPDATE guides SET guides_password = ? WHERE guides_id = ?",
          [hashed, reset.ref_user_id]
        );
      }
    }

    await db.execute(
      "UPDATE reset_password SET is_used = 1 WHERE reset_code = ?",
      [code]
    );

    return res.json({ message: "รีเซ็ตรหัสผ่านใหม่สำเร็จแล้ว" });
  } catch (err) {
    console.error("เกิดข้อผิดพลาดใน reset-password:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;

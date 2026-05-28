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

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  const { email, user_type } = req.body;

  try {
    if (user_type !== "customer" && user_type !== "guide") {
      return res.status(400).json({ message: "user_type ไม่ถูกต้อง" });
    }

    let user: any;
    let userId: number;

    // 👤 CUSTOMER
    if (user_type === "customer") {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT * FROM customers WHERE cus_email = ?",
        [email],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "ไม่พบอีเมลลูกค้า" });
      }

      user = rows[0];
      userId = user.cus_id;
    }
    // 🧭 GUIDE
    else {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT * FROM guides WHERE guides_email = ?",
        [email],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "ไม่พบอีเมลไกด์" });
      }

      user = rows[0];
      userId = user.guides_id;
    }

    // 🔐 สร้าง PIN ความปลอดภัย 6 หลัก (ให้ตรงตามหน้า UI หน้าที่ 2)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expireAt = new Date(Date.now() + 1000 * 60 * 15); // อายุ 15 นาที

    // 💾 บันทึกลง DB เพื่อรอการตรวจสอบ
    await db.execute(
      `INSERT INTO reset_password (ref_user_id, reset_code, user_type, expire_at, is_used)
       VALUES (?, ?, ?, ?, 0)`,
      [userId, resetCode, user_type, expireAt] as any,
    );

    // 📧 TODO: ในโปรดักชันจริง ต้องเขียนฟังก์ชันส่งเลข resetCode นี้ไปที่อีเมลของผู้ใช้

    return res.json({
      message: "สร้างรหัส PIN รีเซ็ตสำเร็จ",
      resetCode, // ส่งกลับไปให้ Dev เช็ก (ลบออกหรือคอมเมนต์เมื่อขึ้นระบบจริง)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// หน้าที่ 2: VERIFY PIN (ตรวจสอบ PIN ความปลอดภัย)
router.post("/verify-pin", async (req, res) => {
  const { code, user_type } = req.body;

  try {
    if (!code || !user_type) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // 🔎 ตรวจสอบว่ามี PIN นี้ในระบบและยังไม่เคยถูกใช้หรือไม่
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM reset_password WHERE reset_code = ? AND user_type = ? AND is_used = 0",
      [code, user_type],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้อง" });
    }

    const reset = rows[0] as any;

    // ⏳ ตรวจสอบเวลาหมดอายุ
    if (new Date(reset.expire_at) < new Date()) {
      return res.status(400).json({ message: "PIN นี้หมดอายุแล้ว" });
    }

    return res.json({
      message: "PIN ถูกต้อง ยินยอมให้เปลี่ยนรหัสผ่านได้",
      code, // ส่งกลับไปให้ Frontend ถือไว้เพื่อก้าวไปหน้าถัดไป
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;

  try {
    if (!code || !newPassword) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // 🔎 ตรวจเช็ก PIN อีกครั้งก่อนทำการอัปเดตเพื่อความปลอดภัย
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM reset_password WHERE reset_code = ? AND is_used = 0",
      [code],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้อง หรือถูกใช้งานไปแล้ว" });
    }

    const reset = rows[0] as any;

    // ⏳ ตรวจเวลาหมดอายุซ้ำตอนอัปเดต
    if (new Date(reset.expire_at) < new Date()) {
      return res.status(400).json({ message: "PIN หมดอายุแล้ว" });
    }

    // 🔒 เข้ารหัสรหัสผ่านใหม่
    const hashed = await bcrypt.hash(newPassword, 10);

    // 👤 อัปเดตรหัสผ่านแยกตามประเภทผู้ใช้
    if (reset.user_type === "customer") {
      await db.execute(
        "UPDATE customers SET cus_password = ? WHERE cus_id = ?",
        [hashed, reset.ref_user_id],
      );
    } 
    else {
      await db.execute(
        "UPDATE guides SET guides_password = ? WHERE guides_id = ?",
        [hashed, reset.ref_user_id],
      );
    }

    // 🚫 เปลี่ยนสถานะรหัส PIN นี้เป็นใช้งานแล้ว (is_used = 1) ป้องกันการนำมาใช้ซ้ำ
    await db.execute(
      "UPDATE reset_password SET is_used = 1 WHERE reset_code = ?",
      [code],
    );

    return res.json({ message: "รีเซ็ตรหัสผ่านใหม่สำเร็จแล้ว" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;

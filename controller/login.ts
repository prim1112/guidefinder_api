import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";
import crypto from "crypto";
import { sendResetEmail } from "../src/services/mail.service";
import jwt from "jsonwebtoken";

export const router = Router();

// Helper เช็ค password (รองรับทั้ง bcrypt hash และ plain text สำหรับแอดมินเก่า)
async function checkPassword(input: string, stored: string) {
  if (stored.startsWith("$2b$")) {
    return await bcrypt.compare(input, stored);
  }
  return input === stored;
}

// ========================================================
// LOGIN SYSTEM
// ========================================================
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอก Email และ Password" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ⭐ ตรวจสอบความถูกต้อง: บังคับให้ใช้เฉพาะบัญชี @gmail.com เท่านั้น
    if (!cleanEmail.endsWith("@gmail.com")) {
      return res
        .status(400)
        .json({
          message: "❌ อนุญาตให้เข้าสู่ระบบด้วยบัญชี @gmail.com เท่านั้น",
        });
    }

    // 1. ตรวจสอบสิทธิ์ CUSTOMER
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE LOWER(cus_email) = ?",
      [cleanEmail],
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;
      const isValid = await bcrypt.compare(password, user.cus_password);

      if (!isValid)
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

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

    // 2. ตรวจสอบสิทธิ์ GUIDE
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE LOWER(guides_email) = ?",
      [cleanEmail],
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as any;

      if (guide.guides_status === 0)
        return res.status(403).json({ message: "⏳ บัญชีรออนุมัติจากแอดมิน" });
      if (guide.guides_status === 2)
        return res.status(403).json({ message: "❌ บัญชีถูกปฏิเสธ" });

      const isValid = await bcrypt.compare(password, guide.guides_password);
      if (!isValid)
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

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

    // 3. ตรวจสอบสิทธิ์ ADMIN
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE LOWER(admin_email) = ? LIMIT 1",
      [cleanEmail],
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;
      const isValid = await checkPassword(password, admin.admin_password);

      if (!isValid)
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: `✅ Login สำเร็จ (${admin.admin_role})`,
        role: admin.admin_role,
        user: {
          id: admin.admin_id,
          name: admin.admin_name,
          email: admin.admin_email,
        },
      });
    }

    return res.status(404).json({ message: "❌ ไม่พบบัญชีนี้" });
  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "❌ Server Error" });
  }
});

// 1. FORGOT PASSWORD (ขอ PIN)
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) return res.status(400).json({ message: "กรุณากรอกอีเมล" });

    const cleanEmail = email.trim().toLowerCase();
    let userId: number | null = null;
    let userType: string | null = null;

    // ค้นหาอีเมลในตาราง guides
    const [guideRows]: any = await db.execute(
      "SELECT guides_id AS id FROM guides WHERE LOWER(guides_email) = LOWER(?)",
      [cleanEmail],
    );

    if (guideRows.length > 0) {
      userId = guideRows[0].id;
      userType = "guide";
    }

    // หากไม่พบ ให้ค้นหาต่อในตาราง customers
    if (!userId) {
      const [customerRows]: any = await db.execute(
        "SELECT cus_id AS id FROM customers WHERE LOWER(cus_email) = LOWER(?)",
        [cleanEmail],
      );

      if (customerRows.length > 0) {
        userId = customerRows[0].id;
        userType = "customer";
      }
    }

    if (!userId || !userType)
      return res.status(404).json({ message: "ไม่พบบัญชีนี้" });

    // เคลียร์ PIN เก่าของยูสเซอร์รายนี้ทิ้ง เพื่อป้องกันการใช้โค้ดซ้ำ
    await db.execute(
      "UPDATE reset_password SET is_used = 1 WHERE ref_user_id = ? AND user_type = ?",
      [userId, userType],
    );

    const resetCode = crypto.randomInt(100000, 999999).toString();

    // ⭐ กำหนดเวลาหมดอายุให้นับถอยหลัง 2 นาที
    const expireAt = new Date(Date.now() + 2 * 60 * 1000);

    await db.execute(
      `INSERT INTO reset_password (ref_user_id, reset_code, user_type, expire_at, is_used) 
       VALUES (?, ?, ?, ?, 0)`,
      [userId, resetCode, userType, expireAt],
    );

    await sendResetEmail(cleanEmail, resetCode);

    // ⭐ ส่งค่า expires_at กลับไปให้ Frontend ทำหน้าจอนับถอยหลัง
    return res.status(200).json({
      message: "ส่ง PIN ไปที่อีเมลแล้ว",
      expires_at: expireAt.toISOString(),
    });
  } catch (err: any) {
    console.error("❌ FORGOT ERROR:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// 2. VERIFY PIN (ตรวจรหัสคู่กับเวลาปัจจุบัน)
router.post("/verify-pin", async (req: Request, res: Response) => {
  const { pin } = req.body;

  try {
    if (!pin) return res.status(400).json({ message: "กรุณากรอก PIN" });

    // ใช้เวลาจาก Node.js ส่งไปเทียบใน SQL เพื่อป้องกันปัญหา Timezone บน server ไม่ตรงกับ DB
    const now = new Date();

    const [rows]: any = await db.execute(
      `SELECT * FROM reset_password 
       WHERE reset_code = ? AND is_used = 0 AND expire_at > ? 
       ORDER BY reset_id DESC LIMIT 1`,
      [pin, now],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    const reset = rows[0];

    // ผ่านการ Verify แล้ว (ยังไม่เซ็ตเป็น is_used เพื่อรอให้กดบันทึกรหัสใหม่ก่อน)
    return res.status(200).json({
      message: "OK",
      reset_id: reset.reset_id,
      user_type: reset.user_type,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// 3. RESET PASSWORD (อัปเดตรหัสผ่านใหม่)
router.post("/reset-password", async (req: Request, res: Response) => {
  const { reset_id, new_password } = req.body;

  try {
    if (!reset_id) return res.status(400).json({ message: "ไม่พบ reset_id" });
    if (!new_password || new_password.length < 6) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร" });
    }

    const now = new Date();

    // เช็คอีกครั้งว่า PIN นี้ต้องยังไม่ถูกใช้งาน และยังไม่หมดอายุ 2 นาที
    const [rows]: any = await db.execute(
      "SELECT ref_user_id, user_type FROM reset_password WHERE reset_id = ? AND is_used = 0 AND expire_at > ?",
      [reset_id, now],
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "คำขอไม่ถูกต้อง หมดอายุ หรือถูกใช้งานไปแล้ว" });
    }

    const { ref_user_id, user_type } = rows[0];
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // อัปเดตรหัสผ่านลงตารางตามประเภทผู้ใช้
    if (user_type === "guide") {
      await db.execute(
        "UPDATE guides SET guides_password = ? WHERE guides_id = ?",
        [hashedPassword, ref_user_id],
      );
    } else if (user_type === "customer") {
      await db.execute(
        "UPDATE customers SET cus_password = ? WHERE cus_id = ?",
        [hashedPassword, ref_user_id],
      );
    }

    // ⭐ บันทึกเปลี่ยนสถานะเป็นใช้งานแล้ว (is_used = 1) เพื่อเคลียร์ PIN ทันทีหลังจากเปลี่ยนรหัสสำเร็จ
    await db.execute(
      "UPDATE reset_password SET is_used = 1 WHERE reset_id = ?",
      [reset_id],
    );

    return res.status(200).json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// EMAIL TESTING ROUTE
/*router.get("/test-email", async (req, res) => {
  try {
    const result = await sendResetEmail("milin04122562@gmail.com", "0412");
    res.json({ message: "ส่งเมลสำเร็จ", result });
  } catch (err) {
    console.error("❌ TEST EMAIL ERROR:", err);
    res.status(500).json({ message: "ส่งเมลไม่สำเร็จ" });
  }
});*/

export default router;

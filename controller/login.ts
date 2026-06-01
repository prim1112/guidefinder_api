import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";
import { sendResetEmail } from "../services/mail.service";
import jwt from "jsonwebtoken";

export const router = Router();

const SECRET_KEY = process.env.JWT_SECRET || "SUPER_SECRET_KEY_DO_NOT_SHARE";


// ============================
// 🔐 JWT HELPER
// ============================
const createToken = (userId: number, role: string) => {
  return jwt.sign(
    { userId, role },
    SECRET_KEY,
    { expiresIn: "1d" }
  );
};


// ============================
// 🔑 LOGIN (ALL ROLES)
// ============================
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "❌ กรุณากรอก Email และ Password",
      });
    }

    // ================= CUSTOMER =================
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email]
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;

      const isValid = await bcrypt.compare(password, user.cus_password);

      if (!isValid) {
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
      }

      const token = createToken(user.cus_id, "customer");

      return res.json({
        message: "Login สำเร็จ (Customer)",
        role: "customer",
        token,
        user: {
          id: user.cus_id,
          name: user.cus_name,
          email: user.cus_email,
          image: user.cus_imageprofile,
        },
      });
    }


    // ================= GUIDE =================
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email]
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as any;

      if (guide.guides_status === 0) {
        return res.status(403).json({ message: "⏳ รออนุมัติ" });
      }

      if (guide.guides_status === 2) {
        return res.status(403).json({ message: "❌ ถูกปฏิเสธ" });
      }

      const isValid = await bcrypt.compare(password, guide.guides_password);

      if (!isValid) {
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
      }

      const token = createToken(guide.guides_id, "guide");

      return res.json({
        message: "Login สำเร็จ (Guide)",
        role: "guide",
        token,
        user: {
          id: guide.guides_id,
          name: guide.guides_name,
          email: guide.guides_email,
          image: guide.guides_imageprofile,
        },
      });
    }


    // ================= ADMIN / SUPERADMIN =================
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ? LIMIT 1",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      const isValid = await bcrypt.compare(password, admin.admin_password);

      if (!isValid) {
        return res.status(401).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
      }

      const role = admin.admin_role; // "admin" | "superadmin"
      const token = createToken(admin.admin_id, role);

      return res.json({
        message: `Login สำเร็จ (${role})`,
        role: role,
        token,
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


// ============================
// 🔐 FORGOT PASSWORD
// ============================
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "กรุณากรอกอีเมล" });
    }

    const [rows]: any = await db.execute(
      `SELECT guides_id FROM guides WHERE guides_email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบบัญชีนี้" });
    }

    const userId = rows[0].guides_id;

    await db.execute(
      `UPDATE reset_password SET is_used = 1 WHERE ref_user_id = ?`,
      [userId]
    );

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    const expireAt = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await db.execute(
      `INSERT INTO reset_password (ref_user_id, reset_code, user_type, expire_at, is_used)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, resetCode, "guide", expireAt, 0]
    );

    await sendResetEmail(email, resetCode);

    return res.json({ message: "ส่ง PIN สำเร็จ" });

  } catch (err: any) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});


// ============================
// 🔐 VERIFY PIN
// ============================
router.post("/verify-pin", async (req: Request, res: Response) => {
  const { pin } = req.body;

  try {
    const [rows]: any = await db.execute(
      `SELECT * FROM reset_password 
       WHERE reset_code = ? AND is_used = 0
       ORDER BY reset_id DESC LIMIT 1`,
      [pin]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "PIN ไม่ถูกต้อง" });
    }

    const reset = rows[0];

    if (new Date(reset.expire_at) < new Date()) {
      return res.status(400).json({ message: "PIN หมดอายุ" });
    }

    await db.execute(
      `UPDATE reset_password SET is_used = 1 WHERE reset_id = ?`,
      [reset.reset_id]
    );

    return res.json({
      message: "OK",
      reset_id: reset.reset_id,
    });

  } catch (err: any) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});


// ============================
// 🔐 RESET PASSWORD
// ============================
router.post("/reset-password", async (req: Request, res: Response) => {
  const { reset_id, new_password } = req.body;

  try {
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        message: "รหัสผ่านต้องอย่างน้อย 6 ตัว",
      });
    }

    const [rows]: any = await db.execute(
      `SELECT ref_user_id, user_type 
       FROM reset_password 
       WHERE reset_id = ? AND is_used = 1`,
      [reset_id]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "คำขอไม่ถูกต้อง" });
    }

    const { ref_user_id, user_type } = rows[0];

    const hashed = await bcrypt.hash(new_password, 10);

    if (user_type === "guide") {
      await db.execute(
        `UPDATE guides SET guides_password = ? WHERE guides_id = ?`,
        [hashed, ref_user_id]
      );
    }

    return res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });

  } catch (err: any) {
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

export default router;
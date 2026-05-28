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

// =====================
// 🔑 FORGOT PASSWORD
// =====================
router.post("/forgot-password", async (req, res) => {
  const { email, user_type } = req.body;

  try {
    let user: any;
    let userId: number;

    // 👤 CUSTOMER
    if (user_type === "customer") {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT * FROM customers WHERE cus_email = ?",
        [email]
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
        [email]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "ไม่พบอีเมลไกด์" });
      }

      user = rows[0];
      userId = user.guides_id;
    }

    const resetCode = crypto.randomBytes(20).toString("hex");

    await db.execute(
      `INSERT INTO reset_table (ref_user_id, reset_code, user_type)
       VALUES (?, ?, ?)`,
      [userId, resetCode, user_type] as any
    );

    return res.json({
      message: "สร้างลิงก์รีเซ็ตสำเร็จ",
      resetCode,
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});


// =====================
// 🔓 RESET PASSWORD
// =====================
router.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body;

  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM reset_table WHERE reset_code = ?",
      [code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "code ไม่ถูกต้อง" });
    }

    const reset = rows[0] as any;
    const hashed = await bcrypt.hash(newPassword, 10);

    // 👤 CUSTOMER
    if (reset.user_type === "customer") {
      await db.execute(
        "UPDATE customers SET cus_password = ? WHERE cus_id = ?",
        [hashed, reset.ref_user_id]
      );
    }

    // 🧭 GUIDE
    else {
      await db.execute(
        "UPDATE guides SET guides_password = ? WHERE guides_id = ?",
        [hashed, reset.ref_user_id]
      );
    }

    await db.execute(
      "DELETE FROM reset_table WHERE reset_code = ?",
      [code]
    );

    return res.json({ message: "รีเซ็ตรหัสผ่านสำเร็จ" });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});


export default router;

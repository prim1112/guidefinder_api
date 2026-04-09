import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "❌ กรุณากรอก Email และ Password" });
    }

    // --- 🔍 1. ค้นหาในตาราง Customer ---
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?", [email]
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;
      const isMatch = await bcrypt.compare(password, user.cus_password).catch(() => false);
      
      if (!isMatch) return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Customer)",
        role: "customers",
        user: { 
          cus_id: user.cus_id, 
          cus_name: user.cus_name, 
          cus_email: user.cus_email 
        },
      });
    }

    // --- 🔍 2. ค้นหาในตาราง Guide ---
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?", [email]
    );

    if (guideRows.length > 0) {
      const user = guideRows[0] as any;
      const isMatch = await bcrypt.compare(password, user.guides_password).catch(() => false);

      if (!isMatch) return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Guide)",
        role: "guide",
        user: { 
          guides_id: user.guides_id, 
          guides_name: user.guides_name, 
          guides_email: user.guides_email 
        },
      });
    }

    // --- 🔍 3. ค้นหาในตาราง Admin ---
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ?", [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;
      let isAdminValid = false;

      // เช็คแบบ Plain Text (รหัสปกติที่พิมพ์ใน DB)
      if (password === admin.admin_password) {
        isAdminValid = true;
      } else {
        // ถ้าไม่ตรง ลองเช็คแบบ Bcrypt (ดัก error กรณีรหัสใน DB สั้นเกินไป)
        isAdminValid = await bcrypt.compare(password, admin.admin_password).catch(() => false);
      }

      if (!isAdminValid) return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Admin)",
        role: "admin",
        user: { 
          admin_id: admin.admin_id, 
          admin_name: admin.admin_name, 
          admin_email: admin.admin_email 
        },
      });
    }

    return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });

  } catch (err: any) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

export default router;
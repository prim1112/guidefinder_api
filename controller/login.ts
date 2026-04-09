import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";

export const router = Router();

// ✅ Login (ตรวจว่าเป็น customer, guide หรือ admin)
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอก Email และ Password" });
    }

    // 🔍 1️⃣ ค้นหาในตาราง customer
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email],
    );
    if (customerRows.length > 0) {
      const user = customerRows[0] as any;
      const isPasswordValid = await bcrypt.compare(password, user.cus_password);
      if (!isPasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
      return res.json({
        message: "✅ Login สำเร็จ (Customer)",
        role: "customers",
        user: {
          cus_id: user.cus_id,
          cus_name: user.cus_name,
          cus_email: user.cus_email,
          cus_imageprofile: user.cus_imageprofile,
        },
      });
    }

    // 🔍 2️⃣ ถ้าไม่พบใน customer → ค้นหาใน guide
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email],
    );
    if (guideRows.length > 0) {
      const guides = guideRows[0] as any;
      const isGuidePasswordValid = await bcrypt.compare(password, guides.guides_password);
      if (!isGuidePasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Guide)",
        role: "guide",
        user: {
          guides_id: guides.guides_id,
          guides_name: guides.guides_name,
          guides_email: guides.guides_email,
          guides_imageprofile: guides.guides_imageprofile,
        },
      });
    }

    // 🔍 3️⃣ ถ้าไม่พบใน guide → ค้นหาใน admin (ส่วนที่แก้ไขเพื่อให้ Admin เข้าได้)
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email],
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      // --- เช็คว่ารหัสที่แอดมินพิมพ์มา ตรงกับใน DB หรือไม่ (แบบ Plain Text) ---
      let isAdminPasswordValid = false;

      if (password === admin.admin_password) {
        isAdminPasswordValid = true; // กรณีพิมพ์รหัสผ่านใน DB ตรงๆ
      } else {
        // เผื่อบางกรณีแอดมินใช้รหัสแบบ Hash
        try {
          isAdminPasswordValid = await bcrypt.compare(password, admin.admin_password);
        } catch (e) {
          isAdminPasswordValid = false;
        }
      }

      if (!isAdminPasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Admin)",
        role: "admin",
        user: {
          admin_id: admin.admin_id,
          admin_name: admin.admin_name,
          admin_email: admin.admin_email,
        },
      });
    }

    // ❌ ไม่พบในทั้งสามตาราง
    return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
  } catch (err: any) {
    console.error("Error in login:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

export default router;
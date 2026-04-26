import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";

export const router = Router();

// ✅ Login (ตรวจว่าเป็น customer, guide หรือ admin)
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // 🔍 validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอก Email และ Password" });
    }

    // =========================
    // 1️⃣ CUSTOMER
    // =========================
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email]
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;

      const isPasswordValid = await bcrypt.compare(
        password,
        user.cus_password
      );

      if (!isPasswordValid) {
        return res.status(400).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

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

    // =========================
    // 2️⃣ GUIDE (🔥 แก้ตรงนี้)
    // =========================
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email]
    );

    if (guideRows.length > 0) {
      const guides = guideRows[0] as any;

      // 🔥 เช็คสถานะก่อน
      if (guides.guides_status === 0) {
        return res.status(403).json({
          message: "⏳ บัญชีของคุณกำลังรอการอนุมัติจากแอดมิน",
        });
      }

      if (guides.guides_status === 2) {
        return res.status(403).json({
          message: "❌ บัญชีของคุณถูกปฏิเสธ",
        });
      }

      // 🔐 เช็ครหัสผ่าน
      const isGuidePasswordValid = await bcrypt.compare(
        password,
        guides.guides_password
      );

      if (!isGuidePasswordValid) {
        return res.status(400).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

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

    // =========================
    // 3️⃣ ADMIN
    // =========================
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      let isAdminPasswordValid = false;

      // รองรับทั้ง plain text และ hash
      if (password === admin.admin_password) {
        isAdminPasswordValid = true;
      } else {
        try {
          isAdminPasswordValid = await bcrypt.compare(
            password,
            admin.admin_password
          );
        } catch (e) {
          isAdminPasswordValid = false;
        }
      }

      if (!isAdminPasswordValid) {
        return res.status(400).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

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

    // =========================
    // ❌ ไม่พบผู้ใช้
    // =========================
    return res.status(400).json({
      message: "❌ ไม่พบบัญชีอีเมลนี้",
    });

  } catch (err: any) {
    console.error("Error in login:", err);

    return res.status(500).json({
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

export default router;
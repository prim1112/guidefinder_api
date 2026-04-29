import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";

export const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // ✅ validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "❌ กรุณากรอก Email และ Password",
      });
    }

    // =========================
    // 🔍 1. CUSTOMER
    // =========================
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email]
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
          id: user.cus_id, // ✅ สำคัญ ต้องตรง Flutter
          name: user.cus_name,
          email: user.cus_email,
          image: user.cus_imageprofile,
        },
      });
    }

    // =========================
    // 🔍 2. GUIDE
    // =========================
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email]
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as any;

      // ✅ check status ก่อน compare password
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

      const isValid = await bcrypt.compare(
        password,
        guide.guides_password
      );

      if (!isValid) {
        return res.status(401).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

      return res.json({
        message: "✅ Login สำเร็จ (Guide)",
        role: "guide",
        user: {
          id: guide.guides_id, // ✅ Flutter ใช้ตัวนี้
          name: guide.guides_name,
          email: guide.guides_email,
          image: guide.guides_imageprofile,
        },
      });
    }

    // =========================
    // 🔍 3. ADMIN
    // =========================
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      let isValid = false;

      // 🔥 รองรับทั้ง hash + plain (แต่แนะนำให้ hash ทั้งหมด)
      try {
        isValid = await bcrypt.compare(password, admin.admin_password);
      } catch {
        isValid = password === admin.admin_password;
      }

      if (!isValid) {
        return res.status(401).json({
          message: "❌ รหัสผ่านไม่ถูกต้อง",
        });
      }

      return res.json({
        message: "✅ Login สำเร็จ (Admin)",
        role: "admin",
        user: {
          id: admin.admin_id,
          name: admin.admin_name,
          email: admin.admin_email,
        },
      });
    }

    // =========================
    // ❌ ไม่พบ user
    // =========================
    return res.status(404).json({
      message: "❌ ไม่พบบัญชีนี้",
    });

  } catch (err: any) {
    console.error("Login Error:", err);

    return res.status(500).json({
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

export default router;
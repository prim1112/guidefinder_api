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
      "SELECT * FROM customer WHERE email = ?",
      [email]
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as {
        cid: number;
        name: string;
        phone: string;
        email: string;
        password: string;
        image_customer: string | null;
      };

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Customer)",
        role: "customer",
        user: {
          cid: user.cid,
          name: user.name,
          phone: user.phone,
          email: user.email,
          image_customer: user.image_customer,
        },
      });
    }

    // 🔍 2️⃣ ถ้าไม่พบใน customer → ค้นหาใน guide
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guide WHERE email = ?",
      [email]
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as {
        gid: number;
        name: string;
        phone: string;
        email: string;
        password: string;
        facebook: string | null;
        language: string | null;
        image_guide: string | null;
        tourism_guide_license: string | null;
        tourism_business_license: string | null;
      };

      const isGuidePasswordValid = await bcrypt.compare(
        password,
        guide.password
      );
      if (!isGuidePasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Guide)",
        role: "guide",
        user: {
          gid: guide.gid,
          name: guide.name,
          phone: guide.phone,
          email: guide.email,
          facebook: guide.facebook,
          language: guide.language,
          image_guide: guide.image_guide,
          tourism_guide_license: guide.tourism_guide_license,
          tourism_business_license: guide.tourism_business_license,
        },
      });
    }

    // 🔍 3️⃣ ถ้าไม่พบใน guide → ค้นหาใน admin
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE email = ?",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as {
        aid: number;
        name: string;
        email: string;
        password: string;
      };

      const isAdminPasswordValid = await bcrypt.compare(
        password,
        admin.password
      );
      if (!isAdminPasswordValid)
        return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });

      return res.json({
        message: "✅ Login สำเร็จ (Admin)",
        role: "admin",
        user: {
          aid: admin.aid,
          name: admin.name,
          email: admin.email,
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

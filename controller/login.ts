import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";
import { RowDataPacket } from "mysql2";
import jwt from "jsonwebtoken";

export const router = Router();

const SECRET_KEY = process.env.JWT_SECRET || "SUPER_SECRET_KEY_DO_NOT_SHARE";


// ============================
// 🔑 LOGIN
// ============================
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูล" });
    }

    // ================= CUSTOMER (NO JWT) =================
    const [customerRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM customers WHERE cus_email = ?",
      [email]
    );

    if (customerRows.length > 0) {
      const user = customerRows[0] as any;

      const isValid = await bcrypt.compare(password, user.cus_password);

      if (!isValid) {
        return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
      }

      return res.json({
        message: "Login สำเร็จ (Customer)",
        role: "customer",
        user: {
          id: user.cus_id,
          name: user.cus_name,
          email: user.cus_email,
          image: user.cus_imageprofile,
        },
      });
    }


    // ================= GUIDE (NO JWT) =================
    const [guideRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM guides WHERE guides_email = ?",
      [email]
    );

    if (guideRows.length > 0) {
      const guide = guideRows[0] as any;

      if (guide.guides_status === 0) {
        return res.status(403).json({ message: "รออนุมัติ" });
      }

      if (guide.guides_status === 2) {
        return res.status(403).json({ message: "ถูกปฏิเสธ" });
      }

      const isValid = await bcrypt.compare(password, guide.guides_password);

      if (!isValid) {
        return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
      }

      return res.json({
        message: "Login สำเร็จ (Guide)",
        role: "guide",
        user: {
          id: guide.guides_id,
          name: guide.guides_name,
          email: guide.guides_email,
          image: guide.guides_imageprofile,
        },
      });
    }


    // ================= ADMIN / SUPERADMIN (JWT ONLY) =================
    const [adminRows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM admin WHERE admin_email = ?",
      [email]
    );

    if (adminRows.length > 0) {
      const admin = adminRows[0] as any;

      const isValid = await bcrypt.compare(password, admin.admin_password);

      if (!isValid) {
        return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
      }

      const role = admin.admin_role; // admin | superadmin

      const token = jwt.sign(
        {
          userId: admin.admin_id,
          role: role,
        },
        SECRET_KEY,
        { expiresIn: "1d" }
      );

      return res.json({
        message: `Login สำเร็จ (${role})`,
        role,
        token, // 🔐 มีเฉพาะ admin/superadmin
        user: {
          id: admin.admin_id,
          name: admin.admin_name,
          email: admin.admin_email,
        },
      });
    }

    return res.status(404).json({ message: "ไม่พบบัญชีนี้" });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
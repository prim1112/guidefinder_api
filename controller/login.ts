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
router.post(
  "/forgot-password",
  async (req: Request, res: Response) => {

    const { email } = req.body;

    try {

      if (!email) {
        return res.status(400).json({
          message: "กรุณากรอกอีเมล",
        });
      }

      // CUSTOMER
      const [customerRows]: any = await db.execute(
        "SELECT cus_id FROM customers WHERE cus_email = ?",
        [email]
      );

      // GUIDE
      const [guideRows]: any = await db.execute(
        "SELECT guides_id FROM guides WHERE guides_email = ?",
        [email]
      );

      let userType = "";
      let userId = 0;

      // CUSTOMER
      if (customerRows.length > 0) {

        userType = "customer";
        userId = customerRows[0].cus_id;

      }

      // GUIDE
      else if (guideRows.length > 0) {

        userType = "guide";
        userId = guideRows[0].guides_id;

      }

      // NOT FOUND
      else {

        return res.status(404).json({
          message: "ไม่พบบัญชีนี้",
        });
      }

      // RANDOM PIN
      const resetCode = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      // EXPIRE 15 MIN
      const expireAt = new Date(
        Date.now() + 15 * 60 * 1000
      )
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

      // INSERT RESET PASSWORD
      await db.execute(
        `
        INSERT INTO reset_password
        (
          ref_user_id,
          reset_code,
          user_type,
          expire_at,
          is_used
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          resetCode,
          userType,
          expireAt,
          0,
        ]
      );

      return res.status(200).json({
        message: "ส่ง PIN สำเร็จ",
        resetCode,
      });

    } catch (err: any) {

      console.error("FORGOT ERROR :", err);

      return res.status(500).json({
        message: "Server error",
        error: err.message,
        sqlMessage: err.sqlMessage,
      });
    }
  }
);



// VERIFY PIN
router.post(
  "/verify-pin",
  async (req: Request, res: Response) => {

    const { code } = req.body;

    try {

      if (!code) {
        return res.status(400).json({
          message: "กรุณากรอกรหัส PIN",
        });
      }

      const [rows]: any = await db.execute(
        `
        SELECT
          reset_id,
          ref_user_id,
          user_type,
          expire_at,
          is_used
        FROM reset_password
        WHERE reset_code = ?
        `,
        [code]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          message: "PIN ไม่ถูกต้อง",
        });
      }

      const reset = rows[0];

      if (reset.is_used == 1) {
        return res.status(400).json({
          message: "PIN ถูกใช้งานแล้ว",
        });
      }

      if (new Date(reset.expire_at) < new Date()) {
        return res.status(400).json({
          message: "PIN หมดอายุแล้ว",
        });
      }

      return res.status(200).json({
        message: "OK",
        reset_id: reset.reset_id,
        ref_user_id: reset.ref_user_id,
        user_type: reset.user_type,
        code,
      });

    } catch (err: any) {

      console.error("VERIFY ERROR :", err);

      return res.status(500).json({
        message: "Server error",
        error: err.message,
        sqlMessage: err.sqlMessage,
      });
    }
  }
);


// RESET PASSWORD
router.post(
  "/reset-password",
  async (req: Request, res: Response) => {

    const { code, newPassword } = req.body;

    try {

      if (!code || !newPassword) {
        return res.status(400).json({
          message: "ข้อมูลไม่ครบ",
        });
      }

      const [rows]: any = await db.execute(
        `
        SELECT *
        FROM reset_password
        WHERE reset_code = ?
        `,
        [code]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          message: "PIN ไม่ถูกต้อง",
        });
      }

      const reset = rows[0];

      if (reset.is_used == 1) {
        return res.status(400).json({
          message: "PIN ถูกใช้แล้ว",
        });
      }

      if (new Date(reset.expire_at) < new Date()) {
        return res.status(400).json({
          message: "PIN หมดอายุแล้ว",
        });
      }

      // HASH PASSWORD
      const hashed = await bcrypt.hash(
        newPassword,
        10
      );

      // CUSTOMER
      if (reset.user_type === "customer") {

        await db.execute(
          `
          UPDATE customers
          SET cus_password = ?
          WHERE cus_id = ?
          `,
          [
            hashed,
            reset.ref_user_id,
          ]
        );

      }

      // GUIDE
      else {

        await db.execute(
          `
          UPDATE guides
          SET guides_password = ?
          WHERE guides_id = ?
          `,
          [
            hashed,
            reset.ref_user_id,
          ]
        );
      }

      // USED
      await db.execute(
        `
        UPDATE reset_password
        SET is_used = 1
        WHERE reset_code = ?
        `,
        [code]
      );

      return res.status(200).json({
        message: "รีเซ็ตรหัสผ่านสำเร็จ",
      });

    } catch (err: any) {

      console.error("RESET ERROR :", err);

      return res.status(500).json({
        message: "Server error",
        error: err.message,
        sqlMessage: err.sqlMessage,
      });
    }
  }
);

export default router;

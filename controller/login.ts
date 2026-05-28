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
        `
        SELECT cus_id
        FROM customers
        WHERE cus_email = ?
        `,
        [email]
      );

      // GUIDE
      const [guideRows]: any = await db.execute(
        `
        SELECT guides_id
        FROM guides
        WHERE guides_email = ?
        `,
        [email]
      );

      let userType = "";
      let userId = 0;

      // CUSTOMER
      if (customerRows.length > 0) {

        userType = "customer";
        userId = Number(customerRows[0].cus_id);

      }

      // GUIDE
      else if (guideRows.length > 0) {

        userType = "guide";
        userId = Number(guideRows[0].guides_id);

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

      // DEBUG
      console.log("USER ID :", userId);
      console.log("USER TYPE :", userType);

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
          Number(userId),
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

    const { pin } = req.body;

    try {

      if (!pin) {
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
        [pin]
      );

      if (rows.length === 0) {

        return res.status(400).json({
          message: "PIN ไม่ถูกต้อง",
        });
      }

      const reset = rows[0];

      // USED
      if (reset.is_used == 1) {

        return res.status(400).json({
          message: "PIN ถูกใช้งานแล้ว",
        });
      }

      // EXPIRED
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
        pin,
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

//reset-password
router.post("/reset-password", async (req, res) => {
  const { email, user_type, new_password } = req.body;

  // เช็คข้อมูล
  if (!email || !user_type || !new_password) {
    return res.status(400).json({
      message: "ข้อมูลไม่ครบ",
    });
  }

  try {
    // CUSTOMER
    if (user_type === "customer") {
      await db.execute(
        `
        UPDATE customers
        SET password = ?
        WHERE email = ?
        `,
        [new_password, email]
      );
    }

    // GUIDE
    else if (user_type === "guide") {
      await db.execute(
        `
        UPDATE guides
        SET password = ?
        WHERE email = ?
        `,
        [new_password, email]
      );
    }

    return res.status(200).json({
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;

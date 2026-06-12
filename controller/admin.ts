import { Request, Response, Router } from "express";
import bcrypt from "bcrypt";
import db from "../db/dbconnect";

export const router = Router();

/*// Middleware เช็ค role
const requireAdmin = (req: Request, res: Response, next: Function) => {
  console.log("ROLE =", (req as any).userRole);

  const role = (req as any).userRole;

  if (role !== "admin" && role !== "superadmin") {
    return res.status(403).json({
      message: "❌ ไม่มีสิทธิ์เข้าถึง",
    });
  }

  next();
};

const requireSuperAdmin = (req: Request, res: Response, next: Function) => {
  const role = (req as any).userRole;
  if (role !== "superadmin") {
    return res.status(403).json({ message: "❌ ต้องเป็น Superadmin เท่านั้น" });
  }
  next();
};*/

// GET: ดึงแอดมินทั้งหมด
router.get("/alladmin", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(
      `SELECT admin_id, admin_name, admin_phonenumber, admin_email, admin_role
       FROM admin
       WHERE admin_role != 'superadmin'`,
    );

    return res.json({
      message: "✅ สำเร็จ",
      data: rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

// GET: ดึงแอดมินตาม ID
router.get("/admin/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows]: any = await db.query(
      "SELECT admin_id, admin_name, admin_phonenumber, admin_email, admin_role FROM admin WHERE admin_id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "❌ ไม่พบแอดมิน" });
    }
    return res.json({ message: "✅ สำเร็จ", data: rows[0] });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "❌ Server Error", error: err.message });
  }
});

// GET: ข้อมูลโปรไฟล์ตัวเอง (superadmin)
router.get("/profile/me", async (req: Request, res: Response) => {
  const adminId = req.headers["user-id"];

  console.log("USER ID =", adminId); // 🔍 debug

  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "❌ ไม่มี user-id",
    });
  }

  try {
    const [rows]: any = await db.query(
      `SELECT
        admin_id,
        admin_name,
        admin_phonenumber,
        admin_email,
        admin_role
       FROM admin
       WHERE admin_id = ?`,
      [adminId],
    );

    console.log("ROWS =", rows); // 🔍 debug

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบข้อมูลแอดมิน",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

router.post("/add/admin", async (req: Request, res: Response) => {
  try {
    let {
      admin_name,
      admin_phonenumber,
      admin_email,
      admin_password,
      admin_role,
    } = req.body;

    console.log("🔥 BODY:", req.body);

    // ================= NORMALIZE =================
    admin_name = admin_name?.trim();
    admin_email = admin_email?.trim().toLowerCase();
    admin_phonenumber = admin_phonenumber?.trim();
    admin_role = admin_role?.trim() || "admin";

    // ================= VALIDATION =================
    if (!admin_name || !admin_email || !admin_password || !admin_phonenumber) {
      return res.status(400).json({
        success: false,
        message: "❌ กรุณากรอกข้อมูลให้ครบ",
      });
    }

    if (admin_phonenumber.length < 9) {
      return res.status(400).json({
        success: false,
        message: "❌ เบอร์โทรไม่ถูกต้อง",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(admin_email)) {
      return res.status(400).json({
        success: false,
        message: "❌ รูปแบบอีเมลไม่ถูกต้อง",
      });
    }

    // ================= CHECK DUPLICATE =================
    const [existing]: any = await db.query(
      "SELECT admin_id FROM admin WHERE admin_email = ?",
      [admin_email],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "❌ Email นี้มีอยู่แล้ว",
      });
    }

    // ================= HASH PASSWORD =================
    const hashedPassword = await bcrypt.hash(admin_password, 10);

    // ================= INSERT =================
    const [result]: any = await db.query(
      `INSERT INTO admin 
      (admin_name, admin_phonenumber, admin_email, admin_password, admin_role)
      VALUES (?, ?, ?, ?, ?)`,
      [admin_name, admin_phonenumber, admin_email, hashedPassword, admin_role],
    );

    return res.status(201).json({
      success: true,
      message: "✅ เพิ่มแอดมินสำเร็จ",
      admin_id: result.insertId,
    });
  } catch (err: any) {
    console.log("🔥 SERVER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

// PUT: แก้ไขข้อมูลตัวเอง (superadmin)
router.put("/profile/me", async (req: Request, res: Response) => {
  const adminId = req.headers["user-id"]; // ✅ FIX

  console.log("ADMIN ID =", adminId);

  if (!adminId) {
    return res.status(400).json({
      message: "❌ ไม่พบ user-id",
    });
  }

  try {
    const [existing]: any = await db.query(
      "SELECT admin_id FROM admin WHERE admin_id = ?",
      [adminId],
    );

    console.log("EXISTING =", existing);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        message: "❌ ไม่พบแอดมิน",
      });
    }

    const { admin_name, admin_phonenumber, admin_email, admin_password } =
      req.body;

    if (admin_password) {
      const hashedPassword = await bcrypt.hash(admin_password, 10);
      await db.query(
        `UPDATE admin SET 
          admin_name = ?, 
          admin_phonenumber = ?, 
          admin_email = ?,
          admin_password = ?
         WHERE admin_id = ?`,
        [admin_name, admin_phonenumber, admin_email, hashedPassword, adminId],
      );
    } else {
      await db.query(
        `UPDATE admin SET 
          admin_name = ?, 
          admin_phonenumber = ?, 
          admin_email = ?
         WHERE admin_id = ?`,
        [admin_name, admin_phonenumber, admin_email, adminId],
      );
    }

    return res.json({ message: "✅ แก้ไขข้อมูลตัวเองสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

// GET /superadmin/admin/search?keyword=...
router.get("/superadmin/admin/search", async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string) || "";

    console.log("🔎 keyword:", keyword);

    if (!keyword) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const search = `%${keyword}%`;

    const [rows]: any = await db.query(
      `
      SELECT 
        admin_id,
        admin_name,
        admin_email,
        admin_phonenumber,
        admin_role
      FROM admin
      WHERE 
        (
          LOWER(admin_name) LIKE LOWER(?)
          OR LOWER(admin_email) LIKE LOWER(?)
          OR admin_phonenumber LIKE ?
        )
      ORDER BY admin_id DESC
      `,
      [search, search, search],
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err: any) {
    console.log("🔥 SEARCH ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

// PUT: แก้ไขแอดมิน (superadmin)
router.put("/editadmin/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    admin_name,
    admin_phonenumber,
    admin_email,
    admin_password,
    admin_role,
  } = req.body;

  try {
    // ✅ 1. ดึงข้อมูลสิทธิ์ (admin_role) เดิมของ ID นี้มาเก็บไว้เผื่อขัดตาทัพด้วย
    const [existing]: any = await db.query(
      "SELECT admin_id, admin_role FROM admin WHERE admin_id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "❌ ไม่พบแอดมิน",
      });
    }

    // ✅ 2. สร้างตัวแปรเช็คความปลอดภัย: ถ้าส่ง admin_role มาให้ใช้ค่าใหม่ ถ้าส่งมาเป็น undefined/null ให้ดึงค่าใน DB เดิมประคองไว้
    const finalRole =
      admin_role !== undefined && admin_role !== null
        ? admin_role
        : existing[0].admin_role;

    // กรณีมีการเปลี่ยนรหัสผ่าน
    if (admin_password && admin_password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(admin_password, 10);

      await db.query(
        `UPDATE admin SET
          admin_name = ?,
          admin_phonenumber = ?,
          admin_email = ?,
          admin_role = ?,
          admin_password = ?
         WHERE admin_id = ?`,
        [
          admin_name,
          admin_phonenumber,
          admin_email,
          finalRole, // ✅ ใช้ finalRole แทนตัวแปรเดิม
          hashedPassword,
          id,
        ],
      );
    } else {
      // กรณีไม่เปลี่ยนรหัสผ่าน
      await db.query(
        `UPDATE admin SET
          admin_name = ?,
          admin_phonenumber = ?,
          admin_email = ?,
          admin_role = ?
         WHERE admin_id = ?`,
        [
          admin_name,
          admin_phonenumber,
          admin_email,
          finalRole, // ✅ ใช้ finalRole แทนตัวแปรเดิมเช่นกัน
          id,
        ],
      );
    }

    return res.status(200).json({
      message: "✅ แก้ไขแอดมินสำเร็จ",
    });
  } catch (err: any) {
    console.error(err);

    return res.status(500).json({
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

// DELETE: ลบแอดมิน (superadmin)
router.delete("/deleteadmin/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // ตรวจสอบว่ามีแอดมินนี้อยู่หรือไม่
    const [rows]: any = await db.query(
      "SELECT admin_id, admin_role FROM admin WHERE admin_id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบแอดมิน",
      });
    }

    // ไม่อนุญาตให้ลบ superadmin
    if (rows[0].admin_role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "❌ ไม่สามารถลบ Superadmin ได้",
      });
    }

    // ลบข้อมูล
    await db.query("DELETE FROM admin WHERE admin_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "✅ ลบแอดมินสำเร็จ",
    });
  } catch (err: any) {
    console.error("Delete Admin Error:", err);

    return res.status(500).json({
      success: false,
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

// แก้ไขข้อมูลไกด์
router.put("/guides/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const { guides_name, guides_phonenumber, guides_email, guides_facebook } =
    req.body;

  try {
    // ================= CHECK INPUT =================
    if (
      !guides_name ||
      !guides_phonenumber ||
      !guides_email ||
      !guides_facebook
    ) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลให้ครบ",
      });
    }

    // ================= CHECK GUIDE EXIST =================
    const [rows]: any = await db.query(
      "SELECT guides_id FROM guides WHERE guides_id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบไกด์",
      });
    }

    // ================= UPDATE GUIDE =================
    await db.query(
      `UPDATE guides SET
        guides_name = ?,
        guides_phonenumber = ?,
        guides_email = ?,
        guides_facebook = ?
      WHERE guides_id = ?`,
      [guides_name, guides_phonenumber, guides_email, guides_facebook, id],
    );

    return res.status(200).json({
      success: true,
      message: "✅ แก้ไขข้อมูลไกด์สำเร็จ",
      guides_id: id,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "❌ Server Error",
      error: err.message,
    });
  }
});

router.delete("/guides/:id", async (req: Request, res: Response) => {
  const { id } = req.params; // หรือ Number(req.params.id) เพื่อความชัวร์ในกรณีที่ DB เป็น Integer

  try {
    // ================= CHECK GUIDE EXIST =================
    const [rows]: any = await db.query(
      "SELECT guides_id FROM guides WHERE guides_id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบไกด์",
      });
    }

    // ==================== เคลียร์ข้อมูลตารางลูก ====================
    
    // 1. หา booking_queue_id ทั้งหมดของไกด์คนนี้ก่อน
    const [bookings]: any = await db.query(
      "SELECT booking_queue_id FROM booking_queues WHERE ref_guid_id = ?",
      [id],
    );

    // 2. ถ้าไกด์คนนี้เคยมีประวัติการจอง ให้ตามไปลบรีวิวต่าง ๆ ให้เกลี้ยง
    if (bookings.length > 0) {
      for (const booking of bookings) {
        // ลบรีวิวสถานที่ท่องเที่ยวที่ผูกกับบุ๊กกิ้งนี้
        await db.query("DELETE FROM review_locations WHERE booking_queue_id = ?", [
          booking.booking_queue_id,
        ]);

        // ลบรีวิวไกด์ที่ผูกกับบุ๊กกิ้งนี้
        await db.query("DELETE FROM review_guides WHERE booking_queue_id = ?", [
          booking.booking_queue_id,
        ]);
      }
    }

    // 3. ลบข้อมูลในตารางบุ๊กกิ้ง (booking_queues) ทั้งหมดของไกด์คนนี้
    await db.query("DELETE FROM booking_queues WHERE ref_guid_id = ?", [id]);

    // ==========================================================

    // ================= DELETE GUIDE (เมื่อเคลียร์หมดแล้ว ลบตัวแม่ได้เลย) =================
    await db.query("DELETE FROM guides WHERE guides_id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: "🗑️ ลบไกด์และข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ",
      guides_id: id,
    });
  } catch (err: any) {
    console.error("ADMIN DELETE GUIDE ERROR =", err);
    return res.status(500).json({
      success: false,
      message: "❌ Server Error",
      error: err.message,
      sqlMessage: err.sqlMessage, // ใส่ไว้เพื่อส่อง Log กรณีที่มีตารางใหม่งอกมาแอบผูก Foreign Key เพิ่ม
    });
  }
});

// แก้ไขข้อมูลลูกค้า
router.put("/customers/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const { cus_name, cus_phonenumber, cus_email, cus_password, role } = req.body;

  // ตรวจสิทธิ์
  if (role !== "admin" && role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "❌ ไม่มีสิทธิ์เข้าถึง",
    });
  }

  // ตรวจข้อมูลบังคับ
  if (!cus_name?.trim() || !cus_phonenumber?.trim() || !cus_email?.trim()) {
    return res.status(400).json({
      success: false,
      message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน",
    });
  }

  try {
    const [rows]: any = await db.query(
      "SELECT cus_id FROM customers WHERE cus_id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "❌ ไม่พบลูกค้า",
      });
    }

    let hashedPassword = null;

    if (cus_password && cus_password.trim() !== "") {
      hashedPassword = await bcrypt.hash(cus_password, 10);
    }

    await db.query(
      `UPDATE customers SET
          cus_name = ?,
          cus_phonenumber = ?,
          cus_email = ?,
          cus_password = COALESCE(?, cus_password)
        WHERE cus_id = ?`,
      [cus_name, cus_phonenumber, cus_email, hashedPassword, id],
    );

    return res.status(200).json({
      success: true,
      message: "✅ แก้ไขข้อมูลลูกค้าสำเร็จ",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.delete("/account/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const { cus_role } = req.body;

    // 🚀 อนุญาตให้ทั้ง admin และ superadmin สามารถกดลบได้
    if (cus_role !== "admin" && cus_role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "❌ เฉพาะแอดมินหรือซูเปอร์แอดมินเท่านั้น",
      });
    }

    // 1. ลบคิวการจอง (ตัดปัญหา Foreign Key Fail)
    // สั่งล้างข้อมูลการจองทั้งหมดที่ติดสัญญากับลูกค้ารายนี้ออกไปก่อน
    await db.query("DELETE FROM booking_queues WHERE ref_cus_id = ?", [id]);

    // 2. ลบบัญชีลูกค้าหลัก
    // เมื่อไม่มีตารางอื่นผูกมัดแล้ว บรรทัดนี้จะทำงานผ่านฉลุย 100%
    await db.query("DELETE FROM customers WHERE cus_id = ?", [id]);

    // ตอบกลับไปหา Flutter แบบสำเร็จ
    res.json({
      success: true,
      message: "✅ แอดมินลบบัญชีและล้างประวัติการจองสำเร็จ",
    });
  } catch (err: any) {
    console.error("Delete Customer Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;

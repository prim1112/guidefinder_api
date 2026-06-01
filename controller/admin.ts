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
      "SELECT admin_id, admin_name, admin_phonenumber, admin_email, admin_role, admin_status FROM admin",
    );
    return res.json({ message: "✅ สำเร็จ", data: rows });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "❌ Server Error", error: err.message });
  }
});

// GET: ดึงแอดมินตาม ID
router.get("/admin/:id",  async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows]: any = await db.query(
      "SELECT admin_id, admin_name, admin_phonenumber, admin_email, admin_role, admin_status FROM admin WHERE admin_id = ?",
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

// POST: เพิ่มแอดมิน (superadmin)
router.post(
  "/aad/admin", async (req: Request, res: Response) => {
    const {
      admin_name,
      admin_phonenumber,
      admin_email,
      admin_password,
      admin_role,
    } = req.body;

    if (!admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ message: "❌ กรุณากรอกข้อมูลให้ครบ" });
    }

    try {
      const [existing]: any = await db.query(
        "SELECT admin_id FROM admin WHERE admin_email = ?",
        [admin_email],
      );

      if (existing.length > 0) {
        return res.status(409).json({ message: "❌ Email นี้มีอยู่แล้ว" });
      }

      const hashedPassword = await bcrypt.hash(admin_password, 10);

      const [result]: any = await db.query(
        `INSERT INTO admin (admin_name, admin_phonenumber, admin_email, admin_password, admin_role, admin_status)
       VALUES (?, ?, ?, ?, ?, 1)`,
        [
          admin_name,
          admin_phonenumber || null,
          admin_email,
          hashedPassword,
          admin_role || "admin",
        ],
      );

      return res.status(201).json({
        message: "✅ เพิ่มแอดมินสำเร็จ",
        admin_id: result.insertId,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: "❌ Server Error", error: err.message });
    }
  },
);

// PUT: แก้ไขข้อมูลตัวเอง (superadmin)
router.put(
  "/profile/me", async (req: Request, res: Response) => {
    const adminId = (req as any).userId; // รับ id จาก header
    const { admin_name, admin_phonenumber, admin_email, admin_password } =
      req.body;

    try {
      const [existing]: any = await db.query(
        "SELECT admin_id FROM admin WHERE admin_id = ?",
        [adminId],
      );

      if (!existing.length) {
        return res.status(404).json({ message: "❌ ไม่พบแอดมิน" });
      }

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
      return res
        .status(500)
        .json({ message: "❌ Server Error", error: err.message });
    }
  },
);

// PUT: แก้ไขแอดมิน (superadmin)
router.put(
  "/edit:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      admin_name,
      admin_phonenumber,
      admin_email,
      admin_password,
      admin_role,
      admin_status,
    } = req.body;

    try {
      const [existing]: any = await db.query(
        "SELECT admin_id FROM admin WHERE admin_id = ?",
        [id],
      );

      if (!existing.length) {
        return res.status(404).json({ message: "❌ ไม่พบแอดมิน" });
      }

      if (admin_password) {
        const hashedPassword = await bcrypt.hash(admin_password, 10);
        await db.query(
          `UPDATE admin SET 
          admin_name = ?, 
          admin_phonenumber = ?, 
          admin_email = ?, 
          admin_role = ?,
          admin_status = ?,
          admin_password = ?
         WHERE admin_id = ?`,
          [
            admin_name,
            admin_phonenumber,
            admin_email,
            admin_role,
            admin_status,
            hashedPassword,
            id,
          ],
        );
      } else {
        await db.query(
          `UPDATE admin SET 
          admin_name = ?, 
          admin_phonenumber = ?, 
          admin_email = ?, 
          admin_role = ?,
          admin_status = ?
         WHERE admin_id = ?`,
          [
            admin_name,
            admin_phonenumber,
            admin_email,
            admin_role,
            admin_status,
            id,
          ],
        );
      }

      return res.json({ message: "✅ แก้ไขแอดมินสำเร็จ" });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: "❌ Server Error", error: err.message });
    }
  },
);

// DELETE: ลบแอดมิน (superadmin)
router.delete(
  "/delete:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const [existing]: any = await db.query(
        "SELECT admin_id, admin_role FROM admin WHERE admin_id = ?",
        [id],
      );

      if (!existing.length) {
        return res.status(404).json({ message: "❌ ไม่พบแอดมิน" });
      }

      if (existing[0].admin_role === "superadmin") {
        return res
          .status(400)
          .json({ message: "❌ ไม่สามารถลบ Superadmin ได้" });
      }

      await db.query("DELETE FROM admin WHERE admin_id = ?", [id]);

      return res.json({ message: "✅ ลบแอดมินสำเร็จ" });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: "❌ Server Error", error: err.message });
    }
  },
);

// แก้ไขข้อมูลไกด์
router.put("/guides/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    guides_name,
    guides_phonenumber,
    guides_email,
    guides_password,
    guides_language,
    guides_facebook,
    guides_province,
    guides_maxcus,
    guides_pricepercusperday,
    guides_status,
  } = req.body;

  try {
    const [rows]: any = await db.query(
      "SELECT guides_id FROM guides WHERE guides_id = ?",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "❌ ไม่พบไกด์",
      });
    }

    let hashedPassword = null;

    if (guides_password && guides_password.trim() !== "") {
      hashedPassword = await bcrypt.hash(guides_password, 10);
    }

    await db.query(
      `UPDATE guides SET
          guides_name = ?,
          guides_phonenumber = ?,
          guides_email = ?,
          guides_language = ?,
          guides_facebook = ?,
          guides_province = ?,
          guides_maxcus = ?,
          guides_pricepercusperday = ?,
          guides_status = ?,
          guides_password = COALESCE(?, guides_password)
        WHERE guides_id = ?`,
      [
        guides_name,
        guides_phonenumber,
        guides_email,
        guides_language,
        guides_facebook,
        guides_province,
        guides_maxcus,
        guides_pricepercusperday,
        guides_status,
        hashedPassword,
        id,
      ],
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

// แก้ไขข้อมูลลูกค้า
router.put("/customers/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    const {
      cus_name,
      cus_phonenumber,
      cus_email,
      cus_password,
      role,
    } = req.body;

    // ตรวจสิทธิ์
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "❌ ไม่มีสิทธิ์เข้าถึง",
      });
    }

    // ตรวจข้อมูลบังคับ
    if (
      !cus_name?.trim() ||
      !cus_phonenumber?.trim() ||
      !cus_email?.trim()
    ) {
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
        [
          cus_name,
          cus_phonenumber,
          cus_email,
          hashedPassword,
          id,
        ],
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
  },
);

router.delete("/admin/account/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // role ของคน login
    const { cus_role } = req.body;

    // อนุญาตเฉพาะ admin
    if (cus_role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "เฉพาะแอดมินเท่านั้น",
      });
    }

    await db.query("DELETE FROM customers WHERE cus_id = ?", [id]);

    res.json({
      success: true,
      message: "แอดมินลบบัญชีสำเร็จ",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;

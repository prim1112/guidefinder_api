import { Request, Response, Router } from "express";
import db from "../db/dbconnect";
import { ResultSetHeader } from "mysql2";

export const router = Router();

// ✅ เพิ่มแพ็กเกจจังหวัด (province_package)
router.post("/province_package", async (req: Request, res: Response) => {
  const { gid, province, max_people, price_per_person } = req.body;

  try {
    // 🔍 ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
    if (!gid || !province || !max_people || !price_per_person) {
      return res
        .status(400)
        .json({ message: "❌ กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    // ✅ บันทึกข้อมูลลงตาราง province_package
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO province_package (gid, province, max_people, price_per_person)
       VALUES (?, ?, ?, ?)`,
      [gid, province, max_people, price_per_person]
    );

    res.json({
      message: "✅ เพิ่มข้อมูล province_package สำเร็จ",
      package_id: result.insertId,
      data: {
        gid,
        province,
        max_people,
        price_per_person,
      },
    });
  } catch (err: any) {
    console.error("Error in POST /province_package:", err);
    res.status(500).json({ message: "❌ Server Error", error: err.message });
  }
});

export default router;

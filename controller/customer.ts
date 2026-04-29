import { Request, Response, Router } from "express";
import multer from "multer";
import streamifier from "streamifier";
import bcrypt from "bcrypt";

import db from "../db/dbconnect";

import cloudinary from "../src/config/configCloud";


export const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 📸 Upload Cloudinary
const uploadToCloudinary = (buffer: Buffer, folder: string) =>
  new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });


// 🔍 GET ALL CUSTOMERS
router.get("/customers", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query(`
      SELECT cus_id, cus_name, cus_email, cus_phonenumber, cus_imageprofile 
      FROM customers
    `);

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});


// 🔍 GET PROFILE
router.get("/profile/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows]: any = await db.query(
      `SELECT cus_id, cus_name, cus_email, cus_phonenumber, cus_imageprofile 
       FROM customers WHERE cus_id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});


// 📝 REGISTER
router.post(
  "/register",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    try {
      const { cus_name, cus_phonenumber, cus_email, cus_password } = req.body;

      if (!cus_email || !cus_password || !cus_phonenumber) {
        return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ" });
      }

      const email = cus_email.toLowerCase();

      // check email/phone
      const [dup]: any = await db.query(
        `SELECT cus_id FROM customers 
         WHERE cus_email = ? OR cus_phonenumber = ?`,
        [email, cus_phonenumber]
      );

      if (dup.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์ถูกใช้งานแล้ว",
        });
      }

      const hashed = await bcrypt.hash(cus_password, 10);

      let imageUrl = null;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        imageUrl = result.secure_url;
      }

      const [result]: any = await db.query(
        `INSERT INTO customers 
        (cus_name, cus_phonenumber, cus_email, cus_password, cus_imageprofile)
        VALUES (?, ?, ?, ?, ?)`,
        [cus_name, cus_phonenumber, email, hashed, imageUrl]
      );

      res.status(201).json({
        success: true,
        cus_id: result.insertId,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);


// ✏️ UPDATE PROFILE
router.put(
  "/profile/:id",
  upload.single("cus_imageprofile"),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const {
        cus_name,
        cus_phonenumber,
        cus_email,
        cus_password,
        confirm_password,
      } = req.body;

      const [rows]: any = await db.query(
        "SELECT * FROM customers WHERE cus_id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }

      const old = rows[0];

      // password check
      if (cus_password && cus_password !== confirm_password) {
        return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
      }

      const email = cus_email ? cus_email.toLowerCase() : old.cus_email;

      // check duplicate
      const [dup]: any = await db.query(
        `SELECT cus_id FROM customers 
         WHERE (cus_email = ? OR cus_phonenumber = ?) AND cus_id != ?`,
        [email, cus_phonenumber || old.cus_phonenumber, id]
      );

      if (dup.length) {
        return res.status(400).json({
          message: "อีเมลหรือเบอร์ถูกใช้งานแล้ว",
        });
      }

      // password
      let password = old.cus_password;
      if (cus_password) {
        password = await bcrypt.hash(cus_password, 10);
      }

      // image
      let image = old.cus_imageprofile;
      if (req.file?.buffer) {
        const result = await uploadToCloudinary(req.file.buffer, "customers");
        image = result.secure_url;
      }

      await db.query(
        `UPDATE customers SET 
          cus_name = ?, 
          cus_phonenumber = ?, 
          cus_email = ?, 
          cus_password = ?, 
          cus_imageprofile = ? 
        WHERE cus_id = ?`,
        [
          cus_name || old.cus_name,
          cus_phonenumber || old.cus_phonenumber,
          email,
          password,
          image,
          id,
        ]
      );

      res.json({
        success: true,
        message: "อัปเดตสำเร็จ",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);


// ❌ DELETE
router.delete("/profile/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows]: any = await db.query(
      "SELECT cus_id FROM customers WHERE cus_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    await db.query("DELETE FROM customers WHERE cus_id = ?", [id]);

    res.json({ success: true, message: "ลบสำเร็จ" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET || "SUPER_SECRET_KEY_DO_NOT_SHARE";

// ขยายสิทธิ์ของ Express Request ให้จำค่าข้อมูลผู้ใช้ที่แกะมาจาก Token ได้
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// 🛡️ ด่านที่ 1: ตรวจสอบความถูกต้องของ JWT Token (สำหรับทุกสิทธิ์ที่ต้องล็อกอิน)
export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // ดึงค่าหลังคำว่า Bearer

  if (!token) {
    return res.status(401).json({ message: "❌ กรุณาเข้าสู่ระบบก่อน (Missing Token)" });
  }

  try {
    // ถอดรหัสและตรวจสอบ Token
    const decoded = jwt.verify(token, SECRET_KEY) as { userId: string; role: string };
    
    // ฝังข้อมูล user ลงใน req เพื่อให้ด่านถัดไปหรือ Controller เอาไปใช้ต่อ
    req.user = decoded; 
    
    next(); // ผ่านด่านแรก ไปต่อได้
  } catch (error) {
    return res.status(403).json({ message: "❌ Token ไม่ถูกต้อง หรือหมดอายุแล้ว" });
  }
};

// 🛡️ ด่านที่ 2: ตรวจสอบสิทธิ์เฉพาะผู้ดูแลระบบ (Admin เท่านั้น)
export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // เช็คว่าผ่านด่านแรกมาแล้ว และมีค่า role ตรงกับ 'admin' หรือไม่
  if (req.user && req.user.role === 'admin') {
    next(); // 🎉 เป็นแอดมินจริง ผ่านเข้าสู่ระบบหลังบ้านแอดมินได้
  } else {
    return res.status(403).json({ message: "❌ ปฏิเสธการเข้าถึง: สำหรับผู้ดูแลระบบเท่านั้น!" });
  }
};
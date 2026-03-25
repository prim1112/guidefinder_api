"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const dbconnect_1 = __importDefault(require("../db/dbconnect"));
exports.router = (0, express_1.Router)();
// ✅ Login (ตรวจว่าเป็น customer, guide หรือ admin)
exports.router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอก Email และ Password" });
        }
        // 🔍 1️⃣ ค้นหาในตาราง customer
        const [customerRows] = await dbconnect_1.default.execute("SELECT * FROM customers WHERE cus_email = ?", [email]);
        if (customerRows.length > 0) {
            const user = customerRows[0];
            const isPasswordValid = await bcrypt_1.default.compare(password, user.cus_password);
            if (!isPasswordValid)
                return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
            return res.json({
                message: "✅ Login สำเร็จ (Customer)",
                role: "customers",
                user: {
                    cus_id: user.cus_id,
                    cus_name: user.cus_name,
                    cus_password: user.cus_password,
                    cus_email: user.cus_email,
                    cus_imageprofile: user.cus_imageprofile,
                },
            });
        }
        // 🔍 2️⃣ ถ้าไม่พบใน customer → ค้นหาใน guide
        const [guideRows] = await dbconnect_1.default.execute("SELECT * FROM guides WHERE guides_email = ?", [email]);
        if (guideRows.length > 0) {
            const guides = guideRows[0];
            const isGuidePasswordValid = await bcrypt_1.default.compare(password, guides.guides_password);
            if (!isGuidePasswordValid)
                return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
            return res.json({
                message: "✅ Login สำเร็จ (Guide)",
                role: "guide",
                user: {
                    guides_id: guides.guides_id,
                    guides_name: guides.guides_name,
                    guides_phonenumber: guides.guides_phonenumber,
                    guides_email: guides.guides_email,
                    guides_facebook: guides.guides_facebook,
                    guides_laguage: guides.guides_laguage,
                    guides_imageprofile: guides.guides_imageprofile,
                    guides_imagelicense: guides.guides_imagelicense,
                    guides_image_business_license: guides.guides_image_business_license,
                },
            });
        }
        // 🔍 3️⃣ ถ้าไม่พบใน guide → ค้นหาใน admin
        const [adminRows] = await dbconnect_1.default.execute("SELECT * FROM admin WHERE admin_email = ?", [email]);
        if (adminRows.length > 0) {
            const admin = adminRows[0];
            const isAdminPasswordValid = await bcrypt_1.default.compare(password, admin.admin_password);
            if (!isAdminPasswordValid)
                return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
            return res.json({
                message: "✅ Login สำเร็จ (Admin)",
                role: "admin",
                user: {
                    admin_id: admin.admin_id,
                    admin_name: admin.admin_name,
                    admin_password: admin.admin_password,
                },
            });
        }
        // ❌ ไม่พบในทั้งสามตาราง
        return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
    }
    catch (err) {
        console.error("Error in login:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=login.js.map
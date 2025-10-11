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
// ✅ Login (แยกว่าเป็น customer หรือ guide)
exports.router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "❌ กรุณากรอก Email และ Password" });
        }
        // 🔍 1️⃣ ค้นหาในตาราง customer
        const [customerRows] = await dbconnect_1.default.execute("SELECT * FROM customer WHERE email = ?", [email]);
        // ถ้ามีข้อมูลใน customer
        if (customerRows.length > 0) {
            const user = customerRows[0];
            if (!user) {
                return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
            }
            const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
            }
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
        const [guideRows] = await dbconnect_1.default.execute("SELECT * FROM guide WHERE email = ?", [email]);
        if (guideRows.length === 0) {
            return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
        }
        const guide = guideRows[0];
        if (!guide) {
            return res.status(400).json({ message: "❌ ไม่พบบัญชีอีเมลนี้" });
        }
        const isGuidePasswordValid = await bcrypt_1.default.compare(password, guide.password);
        if (!isGuidePasswordValid) {
            return res.status(400).json({ message: "❌ รหัสผ่านไม่ถูกต้อง" });
        }
        // ✅ สำเร็จ (Guide)
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
                status: guide.status,
            },
        });
    }
    catch (err) {
        console.error("Error in login:", err);
        res.status(500).json({ message: "❌ Server Error", error: err.message });
    }
});
exports.default = exports.router;
//# sourceMappingURL=login.js.map
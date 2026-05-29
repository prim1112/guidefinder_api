const nodemailer = require("nodemailer");

export const sendResetEmail = async (email: string, pin: string) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "kawitsara47@gmail.com",
      pass: "rmbh vnhj psro wupq", // App Password
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Guide Finder" <kawitsara47@gmail.com>',
      to: email,
      subject: "Reset Password PIN",
      text: `รหัสรีเซ็ตรหัสผ่านของคุณคือ: ${pin}`,
    });

    console.log("EMAIL SENT:", info.messageId);
  } catch (err) {
    console.error("EMAIL FAILED:", err);
    throw err; // 🔥 สำคัญมาก ต้องส่ง error กลับ
  }
};
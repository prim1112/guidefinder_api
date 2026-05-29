const nodemailer = require("nodemailer");

export const sendResetEmail = async (email: string, pin: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "kawitsara47@gmail.com",
      pass: "rmbh vnhj psro wupq",
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

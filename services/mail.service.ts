const nodemailer = require("nodemailer");

export const sendResetEmail = async (email: string, pin: string) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL
    family: 4, // ⭐ บังคับ IPv4 แก้ ENETUNREACH
    auth: {
      user: "yourgmail@gmail.com",
      pass: "your_app_password",
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Guide Finder" <yourgmail@gmail.com>',
      to: email,
      subject: "Reset Password PIN",
      text: `รหัสรีเซ็ตรหัสผ่านของคุณคือ: ${pin}`,
    });

    console.log("EMAIL SENT:", info.response);
  } catch (err) {
    console.log("EMAIL ERROR:", err);
    throw err;
  }
};
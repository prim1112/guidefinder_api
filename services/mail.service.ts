const nodemailer = require("nodemailer");

export const sendResetEmail = async (email: string, pin: string) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4,
    auth: {
      user: "kawitsara47@gmail.com",
      pass: "rmbh vnhj psro wupq",
    },
  });

  try {
    await transporter.sendMail({
      from: '"Guide Finder" <yourgmail@gmail.com>',
      to: email,
      subject: "Reset Password PIN",
      text: `รหัสรีเซ็ตรหัสผ่านของคุณคือ: ${pin}`,
    });

    console.log("EMAIL SENT");
  } catch (err) {
    console.log("EMAIL ERROR:", err);
  }
};
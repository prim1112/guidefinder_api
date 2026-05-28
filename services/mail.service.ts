import nodemailer from "nodemailer";

export const sendResetEmail = async (email: string, pin: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "yourgmail@gmail.com",
      pass: "your_app_password",
    },
  });

  await transporter.sendMail({
    from: '"Guide Finder" <yourgmail@gmail.com>',
    to: email,
    subject: "Reset Password PIN",
    text: `รหัสรีเซ็ตรหัสผ่านของคุณคือ: ${pin}`,
  });
};
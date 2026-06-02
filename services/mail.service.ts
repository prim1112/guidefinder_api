import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

console.log("EMAIL_USER =", process.env.EMAIL_USER);
console.log(
  "EMAIL_PASS =",
  process.env.EMAIL_PASS ? "FOUND" : "NOT FOUND"
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// เช็ค SMTP ตอน Server Start
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP ERROR =", error);
  } else {
    console.log("SMTP READY");
  }
});

// ส่ง PIN รีเซ็ตรหัสผ่าน
export const sendResetEmail = async (
  email: string,
  pin: string
) => {
  try {
    console.log("SEND EMAIL TO =", email);

    const result = await transporter.sendMail({
      from: `"Guide Finder" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Password PIN",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Guide Finder</h2>
          <p>รหัสสำหรับรีเซ็ตรหัสผ่านของคุณคือ</p>
          <h1>${pin}</h1>
          <p>รหัสนี้มีอายุ 15 นาที</p>
        </div>
      `,
    });

    console.log("EMAIL SENT =", result.messageId);

    return result;
  } catch (error) {
    console.error("EMAIL ERROR =", error);
    throw error;
  }
};

// ส่งอีเมลอนุมัติไกด์
export const sendGuideApprovedEmail = async (
  email: string,
  guideName: string
) => {
  try {
    const result = await transporter.sendMail({
      from: `"Guide Finder" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "บัญชีมัคคุเทศก์ได้รับการอนุมัติแล้ว",
      html: `
        <h2>ยินดีด้วย!</h2>
        <p>สวัสดี ${guideName}</p>
        <p>บัญชีมัคคุเทศก์ของคุณได้รับการอนุมัติเรียบร้อยแล้ว</p>
        <p>ขณะนี้คุณสามารถเข้าสู่ระบบและเริ่มรับงานนำเที่ยวได้</p>
      `,
    });

    return result;
  } catch (error) {
    console.error("APPROVED EMAIL ERROR =", error);
    throw error;
  }
};

// ส่งอีเมลไม่ผ่านการอนุมัติ
export const sendGuideRejectedEmail = async (
  email: string,
  guideName: string
) => {
  try {
    const result = await transporter.sendMail({
      from: `"Guide Finder" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "ผลการตรวจสอบบัญชีมัคคุเทศก์",
      html: `
        <h2>ผลการตรวจสอบบัญชี</h2>
        <p>สวัสดี ${guideName}</p>
        <p>บัญชีมัคคุเทศก์ของคุณยังไม่ผ่านการตรวจสอบ</p>
        <p>กรุณาแก้ไขข้อมูลหรือเอกสารและส่งตรวจสอบอีกครั้ง</p>
      `,
    });

    return result;
  } catch (error) {
    console.error("REJECTED EMAIL ERROR =", error);
    throw error;
  }
};
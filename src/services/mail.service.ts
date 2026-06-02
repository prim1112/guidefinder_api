import { Resend } from "resend";

// ใช้ ENV แทนการ hardcode (สำคัญมาก)
const resend = new Resend(process.env.re_iwNoewN4_J94Ft9PVZYyYNae7gqGBf3g1);

// 1. RESET PASSWORD EMAIL
export const sendResetEmail = async (email: string, pin: string) => {
  if (!email) throw new Error("Email is required");

  try {
    console.log("SEND RESET EMAIL TO =", email);

    const result = await resend.emails.send({
      from: "Guide Finder <onboarding@resend.dev>", // dev เท่านั้น
      to: email,
      subject: "Reset Password PIN",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Guide Finder</h2>
          <p>รหัสสำหรับรีเซ็ตรหัสผ่านของคุณคือ</p>
          <h1 style="letter-spacing: 4px;">${pin}</h1>
          <p>รหัสนี้มีอายุ 15 นาที</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("RESET EMAIL ERROR:", result.error);
    }

    console.log("RESET EMAIL RESULT =", result);

    return result;
  } catch (error) {
    console.error("EMAIL ERROR (RESET) =", error);
    throw error;
  }
};


// 2. GUIDE APPROVED EMAIL
export const sendGuideApprovedEmail = async (
  email: string,
  guideName: string
) => {
  if (!email) throw new Error("Email is required");

  try {
    console.log("SEND APPROVED EMAIL TO =", email);

    const result = await resend.emails.send({
      from: "Guide Finder <onboarding@resend.dev>",
      to: email,
      subject: "บัญชีมัคคุเทศก์ได้รับการอนุมัติแล้ว",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>🎉 ยินดีด้วย!</h2>
          <p>สวัสดี <b>${guideName}</b></p>
          <p>บัญชีมัคคุเทศก์ของคุณได้รับการอนุมัติเรียบร้อยแล้ว</p>
          <p>คุณสามารถเข้าสู่ระบบและเริ่มรับงานนำเที่ยวได้ทันที</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("APPROVED EMAIL ERROR:", result.error);
    }

    return result;
  } catch (error) {
    console.error("EMAIL ERROR (APPROVED) =", error);
    throw error;
  }
};


// 3. GUIDE REJECTED EMAIL
export const sendGuideRejectedEmail = async (
  email: string,
  guideName: string
) => {
  if (!email) throw new Error("Email is required");

  try {
    console.log("SEND REJECTED EMAIL TO =", email);

    const result = await resend.emails.send({
      from: "Guide Finder <onboarding@resend.dev>",
      to: email,
      subject: "ผลการตรวจสอบบัญชีมัคคุเทศก์",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>⚠️ ผลการตรวจสอบบัญชี</h2>
          <p>สวัสดี <b>${guideName}</b></p>
          <p>บัญชีของคุณยังไม่ผ่านการตรวจสอบ</p>
          <p>กรุณาแก้ไขข้อมูลหรือเอกสารแล้วส่งใหม่อีกครั้ง</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("REJECTED EMAIL ERROR:", result.error);
    }

    return result;
  } catch (error) {
    console.error("EMAIL ERROR (REJECTED) =", error);
    throw error;
  }
};
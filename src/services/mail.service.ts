import { Resend } from "resend";

// ใช้ ENV แทนการ hardcode (สำคัญมาก)
const resend = new Resend(process.env.RESEND_API_KEY!);

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
          <p>รหัสนี้มีอายุ 2 นาที</p>
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
      subject: "⚠️ แจ้งผลการตรวจสอบบัญชีมัคคุเทศก์ - Guide Finder",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eeeeee; border-radius: 8px; color: #333333;">
          <h2 style="color: #e74c3c; margin-top: 0;">⚠️ ผลการตรวจสอบบัญชีมัคคุเทศก์</h2>
          <p style="font-size: 16px;">สวัสดีครับคุณ <b>${guideName}</b></p>
          <p style="font-size: 15px; line-height: 1.6;">
            ตามที่ท่านได้ยื่นเอกสารสมัครสมาชิกเข้ามา ขณะนี้บัญชีของท่าน<b>ยังไม่ผ่านการอนุมัติ</b>จากระบบ
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #555555;">
            กรุณากรุณาเข้าสู่ระบบผ่านแอปพลิเคชัน เพื่อตรวจสอบความถูกต้อง แก้ไขข้อมูลหรืออัปโหลดเอกสารหลักฐานใหม่อีกครั้งครับ
          </p>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">Guide Finder Application</p>
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
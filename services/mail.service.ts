import { Resend } from "resend";

const resend = new Resend("re_iqSAYnFG_FBgVjRn3AQ8FDqfroYeanfrM");

export const sendResetEmail = async (email: string, pin: string) => {
  await resend.emails.send({
    from: "Guide Finder <onboarding@resend.dev>",
    to: email,
    subject: "Reset Password PIN",
    text: `รหัสรีเซ็ตรหัสผ่านของคุณคือ: ${pin}`,
  });

  console.log("EMAIL SENT");
};

// ส่งอีเมลอนุมัติไกด์
export const sendGuideApprovedEmail = async (
  email: string,
  guideName: string
) => {
  await resend.emails.send({
    from: "Guide Finder <onboarding@resend.dev>",
    to: email,
    subject: "บัญชีมัคคุเทศก์ได้รับการอนุมัติแล้ว",
    html: `
      <h2>ยินดีด้วย!</h2>
      <p>สวัสดี ${guideName}</p>
      <p>บัญชีมัคคุเทศก์ของคุณได้รับการอนุมัติเรียบร้อยแล้ว</p>
      <p>ขณะนี้คุณสามารถเข้าสู่ระบบและเริ่มรับงานนำเที่ยวได้</p>
    `,
  });
};

// ส่งอีเมลไม่ผ่านการอนุมัติ
export const sendGuideRejectedEmail = async (
  email: string,
  guideName: string
) => {
  await resend.emails.send({
    from: "Guide Finder <onboarding@resend.dev>",
    to: email,
    subject: "ผลการตรวจสอบบัญชีมัคคุเทศก์",
    html: `
      <h2>ผลการตรวจสอบบัญชี</h2>
      <p>สวัสดี ${guideName}</p>
      <p>บัญชีมัคคุเทศก์ของคุณยังไม่ผ่านการตรวจสอบ</p>
      <p>กรุณาแก้ไขข้อมูลหรือเอกสารและส่งตรวจสอบอีกครั้ง</p>
    `,
  });
};
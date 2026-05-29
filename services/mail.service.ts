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
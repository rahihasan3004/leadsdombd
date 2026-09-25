import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;
export const EMAIL_FROM = process.env.EMAIL_FROM || "LeadsDom <onboarding@resend.dev>";

export async function sendVerificationOtpEmail(to: string, otp: string) {
  if (!resend) {
    console.log(`[EMAIL_DEV_LOG] Verification OTP for ${to}: ${otp}`);
    return { success: true };
  }
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `${otp} is your LeadsDom verification code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 20px; font-weight: 700;">Verify your LeadsDom account</h2>
            <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">Use the 6-digit verification code below to complete your registration. This code will expire in 15 minutes.</p>
          </div>
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 20px; text-align: center; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; margin: 24px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.4;">If you didn't create an account with LeadsDom, please ignore this email.</p>
        </div>
      `,
    });
    if (result.error) {
      console.error("[RESEND_SEND_ERROR]:", result.error);
    }
    return result;
  } catch (err) {
    console.error("[RESEND_EXCEPTION]:", err);
    return { error: err };
  }
}

export async function sendPasswordResetOtpEmail(to: string, otp: string) {
  if (!resend) {
    console.log(`[EMAIL_DEV_LOG] Password Reset OTP for ${to}: ${otp}`);
    return { success: true };
  }
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `${otp} is your password reset code — LeadsDom`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 20px; font-weight: 700;">Reset your LeadsDom password</h2>
            <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">We received a request to reset your password. Use the 6-digit code below to proceed.</p>
          </div>
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 20px; text-align: center; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; margin: 24px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.4;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
    if (result.error) {
      console.error("[RESEND_SEND_ERROR]:", result.error);
    }
    return result;
  } catch (err) {
    console.error("[RESEND_EXCEPTION]:", err);
    return { error: err };
  }
}

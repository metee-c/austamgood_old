/**
 * Email service using Resend
 * https://resend.com
 */

import { Resend } from 'resend';

// Lazy initialization - create client only when needed
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Default sender email (must be verified in Resend)
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text, from = DEFAULT_FROM } = options;

  console.log('📧 [RESEND] Attempting to send email...');
  console.log('📧 [RESEND] From:', from);
  console.log('📧 [RESEND] To:', to);
  console.log('📧 [RESEND] Subject:', subject);
  console.log('📧 [RESEND] API Key exists:', !!process.env.RESEND_API_KEY);
  console.log('📧 [RESEND] API Key prefix:', process.env.RESEND_API_KEY?.substring(0, 10) + '...');

  const resend = getResendClient();
  
  // Check if API key is configured
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY not configured - email not sent');
    return {
      success: false,
      error: 'Email service not configured'
    };
  }

  try {
    console.log('📧 [RESEND] Calling resend.emails.send()...');
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    });

    if (error) {
      console.error('❌ [RESEND] API Error:', JSON.stringify(error, null, 2));
      return {
        success: false,
        error: error.message
      };
    }

    console.log('✅ [RESEND] Email sent successfully!');
    console.log('✅ [RESEND] Message ID:', data?.id);
    return {
      success: true,
      messageId: data?.id
    };
  } catch (error) {
    console.error('❌ [RESEND] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
): Promise<SendEmailResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>รีเซ็ตรหัสผ่าน - AustamGood WMS</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">AustamGood WMS</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">ระบบจัดการคลังสินค้า</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <h2 style="color: #1e40af; margin-top: 0;">รีเซ็ตรหัสผ่าน</h2>
    
    <p>สวัสดี${userName ? ` คุณ${userName}` : ''},</p>
    
    <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" 
         style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        รีเซ็ตรหัสผ่าน
      </a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">
      หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
      <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
    </p>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>⚠️ หมายเหตุ:</strong> ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
    
    <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
      อีเมลนี้ถูกส่งโดยอัตโนมัติจากระบบ AustamGood WMS<br>
      กรุณาอย่าตอบกลับอีเมลนี้
    </p>
  </div>
  
  <div style="background: #1e293b; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      © 2024 AustamGood WMS - Warehouse Management System
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: 'รีเซ็ตรหัสผ่าน - AustamGood WMS',
    html
  });
}

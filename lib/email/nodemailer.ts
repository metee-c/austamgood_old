import nodemailer from 'nodemailer';

// Gmail SMTP Configuration
// ต้องเปิด 2-Step Verification และสร้าง App Password ที่:
// https://myaccount.google.com/apppasswords

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // App Password ไม่ใช่รหัสผ่านปกติ
  },
});

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * ส่งอีเมลรีเซ็ตรหัสผ่าน
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
  userName?: string
): Promise<EmailResult> {
  console.log('📧 [NODEMAILER] Attempting to send email...');
  console.log('📧 [NODEMAILER] To:', to);
  console.log('📧 [NODEMAILER] GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'NOT SET');
  console.log('📧 [NODEMAILER] GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET');

  // Check if Gmail credentials are configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('⚠️ Gmail credentials not configured - email not sent');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>รีเซ็ตรหัสผ่าน</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">AustamGood WMS</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">ระบบจัดการคลังสินค้า</p>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
    <h2 style="color: #333; margin-top: 0;">รีเซ็ตรหัสผ่าน</h2>
    
    <p>สวัสดี${userName ? ` คุณ${userName}` : ''},</p>
    
    <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
        รีเซ็ตรหัสผ่าน
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>
    <p style="background: #f5f5f5; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 13px; color: #666;">
      ${resetUrl}
    </p>
    
    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>⚠️ หมายเหตุ:</strong> ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
      </p>
    </div>
    
    <p style="color: #666; font-size: 14px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="margin: 0; color: #666; font-size: 12px;">
      © 2025 AustamGood WMS. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  const textContent = `
รีเซ็ตรหัสผ่าน - AustamGood WMS

สวัสดี${userName ? ` คุณ${userName}` : ''},

เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ

คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:
${resetUrl}

ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง

หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้

---
AustamGood WMS
  `;

  try {
    const info = await transporter.sendMail({
      from: `"AustamGood WMS" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'รีเซ็ตรหัสผ่าน - AustamGood WMS',
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ [NODEMAILER] Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('❌ [NODEMAILER] Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

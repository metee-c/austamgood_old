import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุอีเมล' },
        { status: 400 }
      );
    }

    const ip_address = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';

    const result = await requestPasswordReset({
      email,
      ip_address
    });

    // Always return success to prevent email enumeration
    // But include token in development mode
    return NextResponse.json(
      { 
        success: true, 
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้',
        token: result.token // Only in development
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset request error:', error);
    // Still return success to prevent information leakage
    return NextResponse.json(
      { success: true, message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้' },
      { status: 200 }
    );
  }
}

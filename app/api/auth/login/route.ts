// API route for user login
import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { getClientIP } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, remember_me } = body;

    console.log('🔐 LOGIN ATTEMPT:', { email, has_password: !!password });

    // Validate required fields
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 }
      );
    }

    // Get client information
    const ip_address = getClientIP(request);
    const user_agent = request.headers.get('user-agent') || undefined;

    console.log('📍 Client info:', { ip_address, user_agent: user_agent?.substring(0, 50) });

    // Attempt login
    const result = await login({
      email,
      password,
      remember_me: remember_me || false,
      ip_address,
      user_agent
    });

    console.log('🔑 Login result:', {
      success: result.success,
      error: result.error,
      error_code: result.error_code,
      has_user: !!result.user,
      has_token: !!result.session_token
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          error_code: result.error_code
        },
        { status: 401 }
      );
    }

    console.log('✅ Login successful for:', email);

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      session_token: result.session_token,
      force_password_change: result.force_password_change || false
    });

    // Set HttpOnly cookie for session
    if (result.session_token) {
      // ถ้าไม่ tick "จดจำฉันไว้" → session cookie (หมดอายุเมื่อปิด browser)
      // ถ้า tick "จดจำฉันไว้" → persistent cookie (30 วัน)
      const cookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', // เปลี่ยนจาก 'lax' เป็น 'strict' เพื่อป้องกัน CSRF
        path: '/',
        // ไม่ระบุ domain เพื่อให้ cookie ทำงานกับ hostname ปัจจุบันเท่านั้น
      };

      if (remember_me) {
        // Persistent cookie - 30 วัน
        cookieOptions.maxAge = 30 * 24 * 60 * 60;
      }
      // ถ้าไม่มี maxAge จะเป็น session cookie (หมดอายุเมื่อปิด browser)

      response.cookies.set('session_token', result.session_token, cookieOptions);
      console.log('🍪 Session cookie set:', {
        remember_me,
        type: remember_me ? 'persistent (30 days)' : 'session (until browser closes)',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
    }

    return response;
  } catch (error) {
    console.error('💥 Login API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

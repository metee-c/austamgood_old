// API route for user login - Simple version without session management
import { NextRequest, NextResponse } from 'next/server';
import { simpleLogin } from '@/lib/auth/simple-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('🔐 [Login API] Login attempt for:', email);

    // Validate required fields
    if (!email || !password) {
      console.log('❌ [Login API] Missing email or password');
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 }
      );
    }

    // Attempt login
    console.log('🔐 [Login API] Calling simpleLogin...');
    const result = await simpleLogin({ email, password });
    console.log('🔐 [Login API] Login result:', { success: result.success, hasToken: !!result.token });

    if (!result.success) {
      console.log('❌ [Login API] Login failed:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    console.log('✅ [Login API] Login successful for user:', result.user?.email);

    // Create response with JWT token in cookie
    const response = NextResponse.json({
      success: true,
      user: result.user
    });

    // Set HttpOnly cookie with JWT token
    if (result.token) {
      console.log('🍪 [Login API] Setting auth_token cookie');
      console.log('🍪 [Login API] NODE_ENV:', process.env.NODE_ENV);
      console.log('🍪 [Login API] JWT_SECRET exists:', !!process.env.JWT_SECRET);
      console.log('🍪 [Login API] User ID:', result.user?.user_id);
      
      // ⚠️ CRITICAL FIX: Cookie settings to prevent session mixing on Vercel
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict' as const, // ✅ Changed from 'lax' to 'strict' to prevent cookie sharing
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
        // ✅ NO domain specified - let browser handle it (prevents cross-subdomain sharing)
      };
      
      console.log('🍪 [Login API] Cookie options:', cookieOptions);
      response.cookies.set('auth_token', result.token, cookieOptions);
      
      // ✅ Add Cache-Control headers to prevent Vercel edge caching
      response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('🍪 [Login API] Cookie set successfully with strict security');
    }

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

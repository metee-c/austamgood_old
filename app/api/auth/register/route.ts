// API route for user registration
import { NextRequest, NextResponse } from 'next/server';
import { registerUser, getCurrentSession } from '@/lib/auth';
export async function POST(request: NextRequest) {
try {
    // Get current session (only authenticated users can register new users)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, email, password, confirm_password, full_name, role_id } = body;

    // Validate required fields
    if (!username || !email || !password || !confirm_password || !full_name || !role_id) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Check if passwords match
    if (password !== confirm_password) {
      return NextResponse.json(
        { error: 'รหัสผ่านไม่ตรงกัน' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'รูปแบบอีเมลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric and underscore only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร ตัวเลข และ _ เท่านั้น' },
        { status: 400 }
      );
    }

    // Register user
    const result = await registerUser({
      username,
      email,
      password,
      full_name,
      role_id,
      created_by: sessionResult.session.user_id
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถสร้างผู้ใช้ได้' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'สร้างผู้ใช้สำเร็จ',
      user_id: result.user_id
    });
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

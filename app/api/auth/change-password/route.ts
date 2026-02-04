// API route for changing password (authenticated users) - Simple version
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, simpleChangePassword } from '@/lib/auth/simple-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const userResult = await getUserFromToken(token);
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { current_password, new_password, confirm_password } = body;

    // Validate required fields
    if (!current_password || !new_password || !confirm_password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Check if new passwords match
    if (new_password !== confirm_password) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ไม่ตรงกัน' },
        { status: 400 }
      );
    }

    // Check if new password is same as current
    if (current_password === new_password) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม' },
        { status: 400 }
      );
    }

    // Change password
    const result = await simpleChangePassword(
      userResult.user.user_id,
      current_password,
      new_password
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ'
    });
  } catch (error) {
    console.error('Change password API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, new_password } = body;

    if (!token || !new_password) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ token และรหัสผ่านใหม่' },
        { status: 400 }
      );
    }

    const result = await resetPassword({
      token,
      new_password
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

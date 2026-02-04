import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมล' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if email exists in master_system_user
    const { data: user, error } = await supabase
      .from('master_system_user')
      .select('user_id, email, is_active')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'ไม่พบอีเมลนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'พบอีเมลในระบบ',
    });
  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการตรวจสอบอีเมล' },
      { status: 500 }
    );
  }
}

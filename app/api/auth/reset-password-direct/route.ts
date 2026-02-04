import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const { email, new_password } = await request.json();

    console.log('🔐 [RESET-PASSWORD] Request received for email:', email);

    if (!email || !new_password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Check if email exists
    const { data: user, error: findError } = await supabase
      .from('master_system_user')
      .select('user_id, email, is_active')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'ไม่พบอีเมลนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกปิดใช้งาน' },
        { status: 403 }
      );
    }

    // Hash new password
    const password_hash = await hashPassword(new_password);
    console.log('🔐 [RESET-PASSWORD] Hashing password for user:', user.user_id);
    console.log('🔐 [RESET-PASSWORD] New password length:', new_password.length);
    console.log('🔐 [RESET-PASSWORD] Generated hash:', password_hash);

    // Update password
    const { data: updateData, error: updateError } = await supabase
      .from('master_system_user')
      .update({
        password_hash,
        password_changed_at: new Date().toISOString(),
        force_password_change: false,
        failed_login_attempts: 0,
        is_locked: false,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
      .select('user_id, email')
      .single();
    
    console.log('🔐 [RESET-PASSWORD] Update result:', updateError ? `ERROR: ${updateError.message}` : 'SUCCESS');
    console.log('🔐 [RESET-PASSWORD] Updated data:', updateData);

    if (updateError) {
      console.error('Update password error:', updateError);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    });
  } catch (error) {
    console.error('Reset password direct error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

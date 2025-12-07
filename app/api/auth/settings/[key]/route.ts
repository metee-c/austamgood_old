// API route for individual setting management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';

/**
 * GET /api/auth/settings/[key]
 * Get specific setting by key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Get current session (require super admin role)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has super admin role
    if (sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'เฉพาะ Super Admin เท่านั้นที่สามารถดูการตั้งค่าได้' },
        { status: 403 }
      );
    }

    const { key } = await params;
    const settingKey = key;
    const supabase = await createClient();

    // Get setting
    const { data: setting, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', settingKey)
      .single();

    if (error || !setting) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่านี้' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      setting
    });
  } catch (error) {
    console.error('Get setting API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/settings/[key]
 * Update setting value
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Get current session (require super admin role)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has super admin role
    if (sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'เฉพาะ Super Admin เท่านั้นที่สามารถแก้ไขการตั้งค่าได้' },
        { status: 403 }
      );
    }

    const { key } = await params;
    const settingKey = key;
    const body = await request.json();
    const { setting_value } = body;

    if (setting_value === undefined) {
      return NextResponse.json(
        { error: 'กรุณาระบุ setting_value' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current setting for audit
    const { data: currentSetting, error: getCurrentError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', settingKey)
      .single();

    if (getCurrentError || !currentSetting) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่านี้' },
        { status: 404 }
      );
    }

    // Validate value based on type
    let validatedValue = setting_value;
    try {
      switch (currentSetting.setting_type) {
        case 'number':
          validatedValue = String(Number(setting_value));
          if (isNaN(Number(validatedValue))) {
            throw new Error('ค่าต้องเป็นตัวเลข');
          }
          break;
        case 'boolean':
          if (setting_value !== 'true' && setting_value !== 'false') {
            throw new Error('ค่าต้องเป็น true หรือ false');
          }
          validatedValue = setting_value;
          break;
        case 'json':
          // Validate JSON
          JSON.parse(setting_value);
          validatedValue = setting_value;
          break;
        default:
          validatedValue = String(setting_value);
      }
    } catch (err: any) {
      return NextResponse.json(
        { error: `ค่าไม่ถูกต้อง: ${err.message}` },
        { status: 400 }
      );
    }

    // Update setting
    const { error: updateError } = await supabase
      .from('system_settings')
      .update({
        setting_value: validatedValue,
        updated_by: sessionResult.session.user_id,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', settingKey);

    if (updateError) {
      console.error('Error updating setting:', updateError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดทการตั้งค่าได้' },
        { status: 500 }
      );
    }

    // Log the change
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'SETTING_UPDATE',
      entity_type: 'SETTING',
      entity_id: settingKey,
      old_values: {
        setting_value: currentSetting.setting_value
      },
      new_values: {
        setting_value: validatedValue
      },
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'อัพเดทการตั้งค่าสำเร็จ'
    });
  } catch (error) {
    console.error('Update setting API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

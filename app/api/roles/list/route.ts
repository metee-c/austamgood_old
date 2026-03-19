import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/roles/list
 * Public-safe endpoint to get role list for forms (role_id and role_name only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

    const { data: roles, error } = await supabase
      .from('master_system_role')
      .select('role_id, role_name, is_active')
      .eq('is_active', true)
      .order('role_name');

    if (error) {
      console.error('Error fetching roles list:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล roles ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, roles: roles || [] });
  } catch (error) {
    console.error('Get roles list API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

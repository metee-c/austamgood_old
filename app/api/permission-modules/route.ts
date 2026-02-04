// API route for permission modules
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/permission-modules
 * Get all permission modules
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get all modules
    const { data: modules, error } = await supabase
      .from('master_permission_module')
      .select('*')
      .order('module_id');

    if (error) {
      console.error('Error fetching modules:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลโมดูลได้' },
        { status: 500 }
      );
    }

    return NextResponse.json(modules || []);
  } catch (error) {
    console.error('Get modules API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

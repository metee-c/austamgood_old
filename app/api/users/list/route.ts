import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/users/list
 * ดึงรายชื่อผู้ใช้งานทั้งหมดจาก master_system_user (สำหรับ dropdown เลือกผู้รับผิดชอบ)
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') !== 'false'; // default true

    let query = supabase
      .from('master_system_user')
      .select('user_id, username, full_name, is_active, role_id')
      .order('full_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    // Exclude system user
    query = query.neq('username', 'system');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to match expected format
    const users = (data || []).map((user) => ({
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      role_id: user.role_id
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error('API Error in GET /api/users/list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);

// app/api/command-center/errors/route.ts
// Error listing for Command Center error tab

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;

    // Count total
    const { count, error: countError } = await supabase
      .from('wms_errors')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Fetch errors with user info
    const { data, error } = await supabase
      .from('wms_errors')
      .select('*')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user info for errors that have user_id
    const userIds = [...new Set((data || []).filter(e => e.user_id).map(e => e.user_id))];
    let usersMap: Record<number, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('master_system_user')
        .select('user_id, username, full_name')
        .in('user_id', userIds);
      if (users) {
        usersMap = Object.fromEntries(users.map(u => [u.user_id, u]));
      }
    }

    const enriched = (data || []).map(err => ({
      ...err,
      username: usersMap[err.user_id]?.username || null,
      user_full_name: usersMap[err.user_id]?.full_name || null,
    }));

    return NextResponse.json({
      data: enriched,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    console.error('Command center errors error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// app/api/command-center/activities/route.ts
// Paginated search API for Command Center activity grid

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || null;
    const activity_type = searchParams.get('activity_type') || null;
    const status = searchParams.get('status') || null;
    const entity_type = searchParams.get('entity_type') || null;
    const user_id = searchParams.get('user_id') ? parseInt(searchParams.get('user_id')!) : null;
    const request_method = searchParams.get('request_method') || null;
    const date_from = searchParams.get('date_from') || null;
    const date_to = searchParams.get('date_to') || null;
    const sort_by = searchParams.get('sort_by') || 'logged_at';
    const sort_dir = searchParams.get('sort_dir') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = (page - 1) * limit;

    const { data, error } = await supabase.rpc('search_command_center', {
      p_search: search,
      p_activity_type: activity_type,
      p_status: status,
      p_entity_type: entity_type,
      p_user_id: user_id,
      p_request_method: request_method,
      p_date_from: date_from,
      p_date_to: date_to,
      p_sort_by: sort_by,
      p_sort_dir: sort_dir,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Command center search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = data && data.length > 0 ? Number(data[0].total_count) : 0;

    return NextResponse.json({
      data: data || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('Command center activities error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// app/api/command-center/activities/route.ts
// Paginated search API for Command Center activity grid
// Uses direct query builder instead of RPC to avoid PostgREST timeout

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_SORT_FIELDS = ['logged_at', 'activity_type', 'activity_status', 'entity_type', 'duration_ms'];

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
    let sort_by = searchParams.get('sort_by') || 'logged_at';
    const sort_dir = searchParams.get('sort_dir') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = (page - 1) * limit;

    if (!VALID_SORT_FIELDS.includes(sort_by)) sort_by = 'logged_at';

    // Query the pre-joined view instead of using RPC (avoids PostgREST RPC timeout)
    let query = supabase
      .from('vw_command_center_activities')
      .select('*', { count: 'estimated' });

    // Apply filters
    if (date_from) query = query.gte('logged_at', date_from);
    if (date_to) query = query.lte('logged_at', date_to);
    if (activity_type) query = query.ilike('activity_type', `%${activity_type}%`);
    if (status) query = query.eq('activity_status', status);
    if (entity_type) query = query.ilike('entity_type', `%${entity_type}%`);
    if (user_id) query = query.eq('user_id', user_id);
    if (request_method) query = query.eq('request_method', request_method);
    if (search) {
      query = query.or(
        `entity_id.ilike.%${search}%,entity_no.ilike.%${search}%,sku_id.ilike.%${search}%,pallet_id.ilike.%${search}%,location_id.ilike.%${search}%,activity_type.ilike.%${search}%,request_path.ilike.%${search}%`
      );
    }

    // Apply sort and pagination
    query = query
      .order(sort_by, { ascending: sort_dir === 'asc', nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Command center search error:', error.message);
      return NextResponse.json({
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        error: error.message,
      });
    }

    const total = count || 0;

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

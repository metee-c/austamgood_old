// app/api/command-center/filters/route.ts
// Returns distinct filter values for Command Center dropdowns
// Uses direct queries instead of RPC to avoid PostgREST timeout

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Fetch recent records (last 1000) from each table in parallel
    // Then extract distinct values client-side — fast and reliable
    const [activityRes, entityRes, userRes] = await Promise.all([
      supabase
        .from('wms_activity_logs')
        .select('activity_type, entity_type')
        .not('activity_type', 'is', null)
        .order('log_id', { ascending: false })
        .limit(2000),
      supabase
        .from('wms_transactions')
        .select('operation_type, request_method')
        .not('operation_type', 'is', null)
        .order('started_at', { ascending: false })
        .limit(2000),
      supabase
        .from('master_system_user')
        .select('user_id, username, full_name')
        .order('username'),
    ]);

    const activityRows = activityRes.data || [];
    const entityRows = entityRes.data || [];

    const activity_types = [...new Set(activityRows.map((r: any) => r.activity_type).filter(Boolean))].sort() as string[];
    const entity_types = [...new Set(activityRows.map((r: any) => r.entity_type).filter(Boolean))].sort() as string[];
    const operation_types = [...new Set(entityRows.map((r: any) => r.operation_type).filter(Boolean))].sort() as string[];
    const request_methods = [...new Set(entityRows.map((r: any) => r.request_method).filter(Boolean))].sort() as string[];

    return NextResponse.json({
      activity_types,
      entity_types,
      operation_types,
      request_methods: request_methods.length > 0 ? request_methods : ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      users: (userRes.data || []).map((u: any) => ({
        user_id: u.user_id,
        username: u.username,
        full_name: u.full_name,
      })),
    });
  } catch (err: any) {
    console.error('Command center filters error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

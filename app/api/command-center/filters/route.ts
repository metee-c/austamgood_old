// app/api/command-center/filters/route.ts
// Returns distinct filter values for Command Center dropdowns

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Get filter options from RPC
    const { data: filterData, error: filterError } = await supabase.rpc('get_command_center_filter_options');

    // Get users who have activity
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select('user_id, username, full_name')
      .order('username');

    if (filterError) {
      console.error('Filter options error:', filterError);
      return NextResponse.json({ error: filterError.message }, { status: 500 });
    }

    const options = filterData && filterData.length > 0 ? filterData[0] : {};

    return NextResponse.json({
      activity_types: options.activity_types || [],
      entity_types: options.entity_types || [],
      operation_types: options.operation_types || [],
      request_methods: options.request_methods || [],
      users: (userData || []).map((u: any) => ({
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

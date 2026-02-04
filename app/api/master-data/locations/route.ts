import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('warehouse_id');
    const location_type = searchParams.get('location_type');
    const active_status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '100');

    const supabase = await createClient();

    let query = supabase
      .from('master_location')
      .select('*')
      .eq('active_status', active_status)
      .order('location_code', { ascending: true })
      .limit(limit);

    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }

    if (location_type) {
      query = query.eq('location_type', location_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching master locations:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    console.error('Error in master locations API:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

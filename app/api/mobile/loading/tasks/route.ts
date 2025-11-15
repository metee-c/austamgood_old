import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: loadlists, error } = await supabase
      .from('wms_loadlists')
      .select(`
        loadlist_id,
        loadlist_code,
        status,
        total_picklists,
        total_packages,
        created_at,
        master_vehicle (
          plate_number,
          vehicle_type
        ),
        master_employee (
          first_name,
          last_name
        )
      `)
      .in('status', ['pending', 'loading'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch loading tasks', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: loadlists || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

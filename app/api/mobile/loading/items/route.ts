import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlist_id = searchParams.get('loadlist_id');

    if (!loadlist_id) {
      return NextResponse.json(
        { error: 'loadlist_id is required' },
        { status: 400 }
      );
    }

    // Get picklists in this loadlist with loading status
    const { data: loadlistPicklists, error } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        id,
        picklist_id,
        sequence,
        loaded_at,
        loaded_by_employee_id,
        picklists:picklist_id (
          id,
          picklist_code,
          status,
          total_lines,
          trip_id,
          trip:trip_id (
            trip_code,
            vehicle:vehicle_id (
              plate_number
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist_id)
      .order('sequence', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch loadlist items', details: error.message },
        { status: 500 }
      );
    }

    // Transform data
    const items = loadlistPicklists?.map((item: any) => ({
      id: item.picklist_id,
      picklist_code: item.picklists?.picklist_code || '',
      status: item.picklists?.status || 'pending',
      total_lines: item.picklists?.total_lines || 0,
      trip_code: item.picklists?.trip?.trip_code || '',
      vehicle_plate: item.picklists?.trip?.vehicle?.plate_number || '',
      is_loaded: !!item.loaded_at,
      loaded_at: item.loaded_at,
      loaded_by: item.loaded_by_employee_id
    })) || [];

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const loadlistId = searchParams.get('loadlist_id');

    if (!loadlistId) {
      return NextResponse.json(
        { error: 'loadlist_id is required' },
        { status: 400 }
      );
    }

    // Fetch picklists in this loadlist with loading status
    const { data: loadlistPicklists, error } = await supabase
      .from('wms_loadlist_picklists')
      .select(`
        picklist_id,
        wms_picklists (
          picklist_code,
          status,
          total_lines,
          wms_trips (
            trip_code,
            master_vehicle (
              plate_number
            )
          )
        ),
        wms_picklist_loading_status (
          is_loaded,
          loaded_at,
          loaded_by
        )
      `)
      .eq('loadlist_id', parseInt(loadlistId));

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch loadlist items', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const items = (loadlistPicklists || []).map((item: any) => ({
      id: item.picklist_id,
      picklist_code: item.wms_picklists.picklist_code,
      status: item.wms_picklists.status,
      total_lines: item.wms_picklists.total_lines,
      trip_code: item.wms_picklists.wms_trips.trip_code,
      vehicle_plate: item.wms_picklists.wms_trips.master_vehicle?.plate_number,
      is_loaded: item.wms_picklist_loading_status?.is_loaded || false
    }));

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

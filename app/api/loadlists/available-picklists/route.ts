import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Fetch picklists that are completed and not already in a loadlist
    const { data: picklists, error } = await supabase
      .from('wms_picklists')
      .select(`
        picklist_id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        created_at,
        wms_trips (
          trip_id,
          trip_code,
          master_vehicle (
            plate_number
          )
        )
      `)
      .eq('status', 'completed')
      .is('wms_loadlist_picklists.picklist_id', null) // Not already in a loadlist
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch available picklists', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const transformedPicklists = (picklists || []).map((picklist: any) => ({
      id: picklist.picklist_id,
      picklist_code: picklist.picklist_code,
      status: picklist.status,
      total_lines: picklist.total_lines,
      total_quantity: picklist.total_quantity,
      created_at: picklist.created_at,
      trip: {
        trip_id: picklist.wms_trips.trip_id,
        trip_code: picklist.wms_trips.trip_code,
        vehicle: picklist.wms_trips.master_vehicle
      }
    }));

    return NextResponse.json(transformedPicklists);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

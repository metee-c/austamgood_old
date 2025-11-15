import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;
    const loadlistId = parseInt(id);

    if (isNaN(loadlistId)) {
      return NextResponse.json(
        { error: 'Invalid loadlist ID' },
        { status: 400 }
      );
    }

    const { data: loadlist, error } = await supabase
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
        ),
        wms_loadlist_picklists (
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
          )
        )
      `)
      .eq('loadlist_id', loadlistId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch loadlist', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const picklists = loadlist.wms_loadlist_picklists || [];
    const transformedLoadlist = {
      loadlist_id: loadlist.loadlist_id,
      loadlist_code: loadlist.loadlist_code,
      status: loadlist.status,
      total_picklists: picklists.length,
      total_packages: picklists.reduce((sum: number, p: any) => sum + (p.wms_picklists?.total_lines || 0), 0),
      created_at: loadlist.created_at,
      vehicle: loadlist.master_vehicle,
      driver: loadlist.master_employee,
      picklists: picklists.map((p: any) => ({
        id: p.picklist_id,
        picklist_code: p.wms_picklists.picklist_code,
        status: p.wms_picklists.status,
        total_lines: p.wms_picklists.total_lines,
        trip: {
          trip_code: p.wms_picklists.wms_trips.trip_code,
          vehicle: p.wms_picklists.wms_trips.master_vehicle
        }
      }))
    };

    return NextResponse.json({ data: transformedLoadlist });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

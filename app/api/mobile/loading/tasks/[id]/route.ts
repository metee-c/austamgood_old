import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: loadlist, error } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        created_at,
        vehicle_id,
        driver_employee_id,
        wms_loadlist_picklists (
          picklist_id,
          picklists:picklist_id (
            id,
            picklist_code,
            status,
            total_lines,
            trip:trip_id (
              trip_code,
              vehicle:vehicle_id (
                plate_number
              )
            )
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch loadlist', details: error.message },
        { status: 500 }
      );
    }

    // Fetch vehicle if exists
    let vehicle = null;
    if (loadlist.vehicle_id) {
      const { data: vehicleData } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type')
        .eq('vehicle_id', loadlist.vehicle_id)
        .single();
      vehicle = vehicleData;
    }

    // Fetch driver if exists
    let driver = null;
    if (loadlist.driver_employee_id) {
      const { data: driverData } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name')
        .eq('employee_id', loadlist.driver_employee_id)
        .single();
      driver = driverData;
    }

    // Calculate total packages from picklists
    const picklists = loadlist.wms_loadlist_picklists || [];
    const totalPackages = picklists.reduce((sum: number, p: any) => {
      return sum + (p.picklists?.total_lines || 0);
    }, 0);

    // Transform data
    const transformedData = {
      loadlist_id: loadlist.id,
      loadlist_code: loadlist.loadlist_code,
      status: loadlist.status,
      total_picklists: picklists.length,
      total_packages: totalPackages,
      created_at: loadlist.created_at,
      vehicle: vehicle,
      driver: driver,
      picklists: picklists.map((lp: any) => ({
        id: lp.picklists?.id,
        picklist_code: lp.picklists?.picklist_code,
        status: lp.picklists?.status,
        total_lines: lp.picklists?.total_lines,
        trip: {
          trip_code: lp.picklists?.trip?.trip_code,
          vehicle: lp.picklists?.trip?.vehicle
        }
      }))
    };

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

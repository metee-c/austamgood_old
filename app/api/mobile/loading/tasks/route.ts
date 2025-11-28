import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch loadlists (all statuses)
    const { data: loadlists, error } = await supabase
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch loading tasks', details: error.message },
        { status: 500 }
      );
    }

    // Get unique vehicle IDs and driver IDs
    const vehicleIds = [...new Set(loadlists?.map((l: any) => l.vehicle_id).filter(Boolean))];
    const driverIds = [...new Set(loadlists?.map((l: any) => l.driver_employee_id).filter(Boolean))];

    // Fetch vehicles
    let vehicleMap: Record<string, any> = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type')
        .in('vehicle_id', vehicleIds);

      vehicles?.forEach((v: any) => {
        vehicleMap[v.vehicle_id] = v;
      });
    }

    // Fetch drivers
    let driverMap: Record<number, any> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name')
        .in('employee_id', driverIds);

      drivers?.forEach((d: any) => {
        driverMap[d.employee_id] = d;
      });
    }

    // Transform data
    const transformedData = loadlists?.map((loadlist: any) => {
      const picklists = loadlist.wms_loadlist_picklists || [];
      const totalPackages = picklists.reduce((sum: number, p: any) => {
        return sum + (p.picklists?.total_lines || 0);
      }, 0);

      return {
        loadlist_id: loadlist.id,
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_picklists: picklists.length,
        total_packages: totalPackages,
        created_at: loadlist.created_at,
        vehicle: loadlist.vehicle_id ? vehicleMap[loadlist.vehicle_id] : null,
        driver: loadlist.driver_employee_id ? driverMap[loadlist.driver_employee_id] : null,
        picklists: picklists.map((p: any) => ({
          id: p.picklist_id,
          picklist_code: p.picklists?.picklist_code,
          status: p.picklists?.status,
          total_lines: p.picklists?.total_lines,
          trip: {
            trip_code: p.picklists?.trip?.trip_code,
            vehicle: p.picklists?.trip?.vehicle
          }
        }))
      };
    }) || [];

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

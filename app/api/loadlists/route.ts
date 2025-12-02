import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: loadlists, error } = await supabase
      .from('loadlists')
      .select(`
        *,
        checker_employee:checker_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        helper_employee:helper_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        route_plan:plan_id (
          plan_code,
          plan_date
        ),
        wms_loadlist_picklists!fk_wms_loadlist_picklists_loadlist (
          picklist_id,
          picklists:picklist_id (
            picklist_code,
            status,
            total_lines,
            loading_door_number,
            trip:trip_id (
              trip_code,
              vehicle:vehicle_id (
                plate_number
              )
            ),
            picklist_items (
              order_id,
              order_no,
              wms_orders (
                order_no,
                shop_name,
                total_weight
              )
            )
          )
        ),
        loadlist_face_sheets (
          face_sheet_id,
          face_sheets:face_sheet_id (
            face_sheet_no,
            status,
            total_packages,
            total_items
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch loadlists', details: error.message },
        { status: 500 }
      );
    }

    // Get trip IDs to fetch trip codes
    const tripIds = loadlists
      ?.map((l: any) => l.trip_id)
      .filter((id: any) => id != null) || [];

    // Fetch trip codes if we have trip IDs
    let tripMap: Record<number, string> = {};
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, trip_code')
        .in('trip_id', tripIds);

      trips?.forEach((trip: any) => {
        if (trip.trip_id) {
          tripMap[trip.trip_id] = trip.trip_code;
        }
      });
    }

    // Get vehicle IDs to fetch vehicle data
    const vehicleIds = loadlists
      ?.map((l: any) => l.vehicle_id)
      .filter((id: any) => id != null) || [];

    let vehicleMap: Record<string, any> = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type')
        .in('vehicle_id', vehicleIds);

      vehicles?.forEach((vehicle: any) => {
        if (vehicle.vehicle_id) {
          vehicleMap[vehicle.vehicle_id] = vehicle;
        }
      });
    }

    // Get driver employee IDs to fetch driver data
    const driverIds = loadlists
      ?.map((l: any) => l.driver_employee_id)
      .filter((id: any) => id != null) || [];

    let driverMap: Record<number, any> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('master_employee')
        .select('employee_id, first_name, last_name, employee_code')
        .in('employee_id', driverIds);

      drivers?.forEach((driver: any) => {
        if (driver.employee_id) {
          driverMap[driver.employee_id] = driver;
        }
      });
    }

    // Transform data to match expected format
    const transformedLoadlists = (loadlists || []).map((loadlist: any) => {
      const picklists = loadlist.wms_loadlist_picklists || [];
      const faceSheets = loadlist.loadlist_face_sheets || [];
      const tripCode = loadlist.trip_id ? tripMap[loadlist.trip_id] : null;
      const vehicle = loadlist.vehicle_id ? vehicleMap[loadlist.vehicle_id] : null;
      const driver = loadlist.driver_employee_id ? driverMap[loadlist.driver_employee_id] : null;

      return {
        id: loadlist.id,
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        loading_door_number: loadlist.loading_door_number,
        loading_queue_number: loadlist.loading_queue_number,
        vehicle_type: loadlist.vehicle_type,
        delivery_number: loadlist.delivery_number,
        driver_phone: loadlist.driver_phone,
        checker_employee: loadlist.checker_employee,
        helper_employee: loadlist.helper_employee,
        plan_id: loadlist.plan_id,
        route_plan: loadlist.route_plan,
        trip_id: loadlist.trip_id,
        trip: tripCode ? { trip_code: tripCode } : null,
        total_picklists: picklists.length,
        total_face_sheets: faceSheets.length,
        total_packages: picklists.reduce((sum: number, p: any) => sum + (p.picklists?.total_lines || 0), 0),
        created_at: loadlist.created_at,
        created_by: loadlist.created_by,
        vehicle: vehicle,
        driver: driver,
        face_sheets: faceSheets.map((fs: any) => ({
          id: fs.face_sheet_id,
          face_sheet_no: fs.face_sheets?.face_sheet_no,
          status: fs.face_sheets?.status,
          total_packages: fs.face_sheets?.total_packages,
          total_items: fs.face_sheets?.total_items
        })),
        picklists: picklists.map((p: any) => {
          // Extract unique orders from picklist items
          const picklistItems = p.picklists?.picklist_items || [];
          const ordersMap = new Map();

          picklistItems.forEach((item: any) => {
            const order = item.wms_orders;
            if (order && item.order_id) {
              ordersMap.set(item.order_id, {
                order_no: order.order_no || item.order_no,
                shop_name: order.shop_name,
                total_weight: order.total_weight
              });
            }
          });

          return {
            id: p.picklist_id,
            picklist_code: p.picklists?.picklist_code,
            status: p.picklists?.status,
            total_lines: p.picklists?.total_lines,
            loading_door_number: p.picklists?.loading_door_number,
            trip: {
              trip_code: p.picklists?.trip?.trip_code,
              vehicle: p.picklists?.trip?.vehicle
            },
            orders: Array.from(ordersMap.values())
          };
        })
      };
    });

    return NextResponse.json(transformedLoadlists);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      picklist_ids,
      face_sheet_ids,
      checker_employee_id,
      vehicle_type,
      delivery_number,
      vehicle_id,
      driver_employee_id,
      driver_phone,
      helper_employee_id,
      loading_queue_number
    } = body;

    // Validation - ต้องมีอย่างน้อย picklist_ids หรือ face_sheet_ids
    const hasPicklists = picklist_ids && Array.isArray(picklist_ids) && picklist_ids.length > 0;
    const hasFaceSheets = face_sheet_ids && Array.isArray(face_sheet_ids) && face_sheet_ids.length > 0;
    
    if (!hasPicklists && !hasFaceSheets) {
      return NextResponse.json(
        { error: 'Either picklist_ids or face_sheet_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!checker_employee_id) {
      return NextResponse.json({ error: 'checker_employee_id is required' }, { status: 400 });
    }
    if (!vehicle_type) {
      return NextResponse.json({ error: 'vehicle_type is required' }, { status: 400 });
    }
    if (!delivery_number) {
      return NextResponse.json({ error: 'delivery_number is required' }, { status: 400 });
    }

    // Fetch picklists to get plan_id and trip_id
    const { data: selectedPicklists, error: picklistsError } = await supabase
      .from('picklists')
      .select('id, plan_id, trip_id')
      .in('id', picklist_ids);

    if (picklistsError) {
      return NextResponse.json(
        { error: 'Failed to fetch picklists', details: picklistsError.message },
        { status: 500 }
      );
    }

    // Get plan_id and trip_id from first picklist (assuming all picklists belong to same plan/trip)
    const plan_id = selectedPicklists && selectedPicklists.length > 0 ? selectedPicklists[0].plan_id : null;
    const trip_id = selectedPicklists && selectedPicklists.length > 0 ? selectedPicklists[0].trip_id : null;

    // Generate loadlist code with pattern: LD-YYYYMMDD-####
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Get the latest loadlist code for today
    const { data: latestLoadlist } = await supabase
      .from('loadlists')
      .select('loadlist_code')
      .like('loadlist_code', `LD-${datePrefix}-%`)
      .order('loadlist_code', { ascending: false })
      .limit(1)
      .single();

    let sequenceNumber = 1;
    if (latestLoadlist && latestLoadlist.loadlist_code) {
      // Extract the sequence number from the latest code
      const lastSequence = latestLoadlist.loadlist_code.split('-')[2];
      if (lastSequence) {
        sequenceNumber = parseInt(lastSequence, 10) + 1;
      }
    }

    const loadlistCode = `LD-${datePrefix}-${String(sequenceNumber).padStart(4, '0')}`;

    // Create loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .insert({
        loadlist_code: loadlistCode,
        plan_id,
        trip_id,
        status: 'pending',
        checker_employee_id,
        vehicle_type,
        delivery_number,
        vehicle_id: vehicle_id || null,
        driver_employee_id: driver_employee_id || null,
        driver_phone: driver_phone || null,
        helper_employee_id: helper_employee_id || null,
        loading_queue_number: loading_queue_number || null,
        created_by: null // In real app, get from auth (UUID)
      })
      .select()
      .single();

    if (loadlistError) {
      return NextResponse.json(
        { error: 'Failed to create loadlist', details: loadlistError.message },
        { status: 500 }
      );
    }

    // Link picklists to loadlist (if any)
    if (hasPicklists) {
      const loadlistPicklistsData = picklist_ids.map((picklist_id: number) => ({
        loadlist_id: loadlist.id,
        picklist_id: picklist_id
      }));

      const { error: linkError } = await supabase
        .from('loadlist_picklists')
        .insert(loadlistPicklistsData);

      if (linkError) {
        // Cleanup: delete the loadlist if linking failed
        await supabase
          .from('loadlists')
          .delete()
          .eq('id', loadlist.id);

        return NextResponse.json(
          { error: 'Failed to link picklists to loadlist', details: linkError.message },
          { status: 500 }
        );
      }
    }

    // Link face sheets to loadlist (if any)
    if (hasFaceSheets) {
      const loadlistFaceSheetsData = face_sheet_ids.map((face_sheet_id: number) => ({
        loadlist_id: loadlist.id,
        face_sheet_id: face_sheet_id
      }));

      const { error: linkError } = await supabase
        .from('loadlist_face_sheets')
        .insert(loadlistFaceSheetsData);

      if (linkError) {
        // Cleanup: delete the loadlist if linking failed
        await supabase
          .from('loadlists')
          .delete()
          .eq('id', loadlist.id);

        return NextResponse.json(
          { error: 'Failed to link face sheets to loadlist', details: linkError.message },
          { status: 500 }
        );
      }
    }

    // Fetch the complete loadlist with relations
    const { data: completeLoadlist, error: fetchError } = await supabase
      .from('loadlists')
      .select(`
        *,
        checker_employee:checker_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        helper_employee:helper_employee_id (
          first_name,
          last_name,
          employee_code
        ),
        wms_loadlist_picklists!fk_wms_loadlist_picklists_loadlist (
          picklist_id,
          picklists:picklist_id (
            picklist_code,
            status,
            total_lines,
            trip:trip_id (
              trip_code,
              vehicle:vehicle_id (
                plate_number
              )
            ),
            picklist_items (
              order_id,
              order_no,
              wms_orders:order_id (
                order_no,
                shop_name,
                total_weight
              )
            )
          )
        )
      `)
      .eq('id', loadlist.id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch created loadlist', details: fetchError.message },
        { status: 500 }
      );
    }

    // Transform the response
    const picklists = completeLoadlist.wms_loadlist_picklists || [];
    const transformedLoadlist = {
      id: completeLoadlist.id,
      loadlist_code: completeLoadlist.loadlist_code,
      status: completeLoadlist.status,
      loading_door_number: completeLoadlist.loading_door_number,
      loading_queue_number: completeLoadlist.loading_queue_number,
      vehicle_type: completeLoadlist.vehicle_type,
      delivery_number: completeLoadlist.delivery_number,
      driver_phone: completeLoadlist.driver_phone,
      checker_employee: completeLoadlist.checker_employee,
      helper_employee: completeLoadlist.helper_employee,
      total_picklists: picklists.length,
      total_packages: picklists.reduce((sum: number, p: any) => sum + (p.picklists?.total_lines || 0), 0),
      created_at: completeLoadlist.created_at,
      created_by: completeLoadlist.created_by,
      vehicle: null,
      driver: null,
      picklists: picklists.map((p: any) => {
        // Extract unique orders from picklist items
        const picklistItems = p.picklists?.picklist_items || [];
        const ordersMap = new Map();

        picklistItems.forEach((item: any) => {
          const order = item.wms_order_items?.wms_orders;
          if (order && order.order_id) {
            ordersMap.set(order.order_id, {
              order_no: order.order_no,
              shop_name: order.shop_name
            });
          }
        });

        return {
          id: p.picklist_id,
          picklist_code: p.picklists?.picklist_code,
          status: p.picklists?.status,
          total_lines: p.picklists?.total_lines,
          trip: {
            trip_code: p.picklists?.trip?.trip_code,
            vehicle: p.picklists?.trip?.vehicle
          },
          orders: Array.from(ordersMap.values())
        };
      })
    };

    return NextResponse.json(transformedLoadlist);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

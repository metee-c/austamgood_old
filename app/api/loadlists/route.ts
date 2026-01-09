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
        ),
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          bonus_face_sheets:bonus_face_sheet_id (
            face_sheet_no,
            status,
            total_packages,
            total_items,
            total_orders
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
    let tripMap: Record<number, { trip_code: string; daily_trip_number: number | null }> = {};
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, trip_code, daily_trip_number')
        .in('trip_id', tripIds);

      trips?.forEach((trip: any) => {
        if (trip.trip_id) {
          tripMap[trip.trip_id] = {
            trip_code: trip.trip_code,
            daily_trip_number: trip.daily_trip_number
          };
        }
      });
    }

    // Get vehicle IDs to fetch vehicle data
    const vehicleIds = loadlists
      ?.map((l: any) => l.vehicle_id)
      .filter((id: any) => id != null)
      .map((id: any) => parseInt(id, 10))
      .filter((id: any) => !isNaN(id)) || [];

    let vehicleMap: Record<number, any> = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from('master_vehicle')
        .select('vehicle_id, plate_number, vehicle_type, model')
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
      const bonusFaceSheets = loadlist.wms_loadlist_bonus_face_sheets || [];
      const tripData = loadlist.trip_id ? tripMap[loadlist.trip_id] : null;
      const vehicleIdNum = loadlist.vehicle_id ? parseInt(loadlist.vehicle_id, 10) : null;
      const vehicle = vehicleIdNum && !isNaN(vehicleIdNum) ? vehicleMap[vehicleIdNum] : null;
      const driver = loadlist.driver_employee_id ? driverMap[loadlist.driver_employee_id] : null;

      // Debug logging
      console.log(`🚚 Loadlist ${loadlist.loadlist_code}:`, {
        loading_door_number: loadlist.loading_door_number,
        vehicle_id: loadlist.vehicle_id,
        vehicleIdNum,
        vehicle: vehicle ? { vehicle_id: vehicle.vehicle_id, plate_number: vehicle.plate_number, model: vehicle.model } : null,
        driver_employee_id: loadlist.driver_employee_id,
        driver: driver ? { employee_id: driver.employee_id, name: `${driver.first_name} ${driver.last_name}` } : null
      });

      // คำนวณจำนวนพัสดุจาก picklists เท่านั้น (ไม่นับ face sheets และ bonus face sheets)
      const totalPackages = picklists.reduce((sum: number, p: any) => sum + (p.picklists?.total_lines || 0), 0);

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
        trip: tripData ? { trip_code: tripData.trip_code, daily_trip_number: tripData.daily_trip_number } : null,
        total_picklists: picklists.length,
        total_face_sheets: faceSheets.length,
        total_bonus_face_sheets: bonusFaceSheets.length,
        total_packages: totalPackages,
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
        bonus_face_sheets: bonusFaceSheets.map((bfs: any) => ({
          id: bfs.bonus_face_sheet_id,
          face_sheet_no: bfs.bonus_face_sheets?.face_sheet_no,
          status: bfs.bonus_face_sheets?.status,
          total_packages: bfs.bonus_face_sheets?.total_packages,
          total_items: bfs.bonus_face_sheets?.total_items,
          total_orders: bfs.bonus_face_sheets?.total_orders
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

          const orders = Array.from(ordersMap.values());
          
          // Debug log
          console.log(`Picklist ${p.picklists?.picklist_code}:`, {
            items_count: picklistItems.length,
            orders_count: orders.length,
            orders: orders
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
            orders: orders
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
      bonus_face_sheet_ids,
      bonus_face_sheet_mappings, // ✅ NEW: รับ mapping ของ bonus face sheet กับ picklist และ face sheet
      checker_employee_id,
      vehicle_type,
      delivery_number,
      vehicle_id,
      driver_employee_id,
      driver_phone,
      helper_employee_id,
      loading_queue_number,
      loading_door_number
    } = body;

    // Validation - ต้องมีอย่างน้อย picklist_ids, face_sheet_ids หรือ bonus_face_sheet_ids
    const hasPicklists = picklist_ids && Array.isArray(picklist_ids) && picklist_ids.length > 0;
    const hasFaceSheets = face_sheet_ids && Array.isArray(face_sheet_ids) && face_sheet_ids.length > 0;
    const hasBonusFaceSheets = bonus_face_sheet_ids && Array.isArray(bonus_face_sheet_ids) && bonus_face_sheet_ids.length > 0;

    if (!hasPicklists && !hasFaceSheets && !hasBonusFaceSheets) {
      return NextResponse.json(
        { error: 'At least one of picklist_ids, face_sheet_ids, or bonus_face_sheet_ids is required and must be a non-empty array' },
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

    // Fetch picklists to get plan_id and trip_id (only if we have picklist_ids)
    let plan_id = null;
    let trip_id = null;

    if (hasPicklists) {
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
      plan_id = selectedPicklists && selectedPicklists.length > 0 ? selectedPicklists[0].plan_id : null;
      trip_id = selectedPicklists && selectedPicklists.length > 0 ? selectedPicklists[0].trip_id : null;
    }

    // Generate loadlist code with pattern: LD-YYYYMMDD-####
    // ใช้ plan_date จาก Route Plan ถ้ามี, หรือ delivery_date จาก bonus face sheet, ไม่งั้นใช้วันที่ปัจจุบัน
    let datePrefix: string;
    let deliveryDate: string | null = null;
    
    if (plan_id) {
      // Fetch plan_date from route plan
      const { data: routePlan } = await supabase
        .from('receiving_route_plans')
        .select('plan_date')
        .eq('plan_id', plan_id)
        .single();
      
      if (routePlan?.plan_date) {
        // plan_date format: "2026-01-07"
        deliveryDate = routePlan.plan_date;
      }
    }
    
    // ถ้าไม่มี plan_date ให้ดึง delivery_date จาก bonus face sheet
    if (!deliveryDate && hasBonusFaceSheets) {
      const { data: bonusFaceSheet } = await supabase
        .from('bonus_face_sheets')
        .select('delivery_date')
        .eq('id', bonus_face_sheet_ids[0])
        .single();
      
      if (bonusFaceSheet?.delivery_date) {
        deliveryDate = bonusFaceSheet.delivery_date;
      }
    }
    
    // ถ้าไม่มี delivery_date ให้ดึงจาก face sheet
    if (!deliveryDate && hasFaceSheets) {
      const { data: faceSheet } = await supabase
        .from('face_sheets')
        .select('delivery_date')
        .eq('id', face_sheet_ids[0])
        .single();
      
      if (faceSheet?.delivery_date) {
        deliveryDate = faceSheet.delivery_date;
      }
    }
    
    if (deliveryDate) {
      // date format: "2026-01-07"
      datePrefix = deliveryDate.replace(/-/g, '');
    } else {
      // Fallback to today
      const today = new Date();
      datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    }

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

    // Debug: Log what we're about to insert
    const insertData = {
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
      loading_door_number: loading_door_number || null,
      created_by: null // In real app, get from auth (UUID)
    };

    console.log('📝 [API] Inserting loadlist:', {
      vehicle_id: insertData.vehicle_id,
      driver_employee_id: insertData.driver_employee_id,
      loading_door_number: insertData.loading_door_number
    });

    // Create loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .insert(insertData)
      .select()
      .single();

    console.log('✅ [API] Loadlist created:', {
      id: loadlist?.id,
      code: loadlist?.loadlist_code,
      vehicle_id: loadlist?.vehicle_id,
      driver_employee_id: loadlist?.driver_employee_id,
      loading_door_number: loadlist?.loading_door_number
    });

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

      console.log('🔗 Linking picklists to loadlist:', { loadlist_id: loadlist.id, picklist_ids });

      const { error: linkError } = await supabase
        .from('wms_loadlist_picklists')
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

    // Link bonus face sheets to loadlist (if any)
    if (hasBonusFaceSheets) {
      const loadlistBonusFaceSheetsData = bonus_face_sheet_ids.map((bonus_face_sheet_id: number) => ({
        loadlist_id: loadlist.id,
        bonus_face_sheet_id: bonus_face_sheet_id
      }));

      const { error: linkError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .insert(loadlistBonusFaceSheetsData);

      if (linkError) {
        // Cleanup: delete the loadlist if linking failed
        await supabase
          .from('loadlists')
          .delete()
          .eq('id', loadlist.id);

        return NextResponse.json(
          { error: 'Failed to link bonus face sheets to loadlist', details: linkError.message },
          { status: 500 }
        );
      }

      // ✅ NEW: บันทึก mapping ของ bonus face sheet กับ face sheet ลง loadlist_face_sheets
      if (bonus_face_sheet_mappings && Array.isArray(bonus_face_sheet_mappings)) {
        const mappedFaceSheetIds = bonus_face_sheet_mappings
          .filter((m: any) => m.face_sheet_id)
          .map((m: any) => m.face_sheet_id);

        if (mappedFaceSheetIds.length > 0) {
          const loadlistFaceSheetsData = mappedFaceSheetIds.map((face_sheet_id: number) => ({
            loadlist_id: loadlist.id,
            face_sheet_id: face_sheet_id
          }));

          console.log('🔗 Linking mapped face sheets to loadlist:', { loadlist_id: loadlist.id, face_sheet_ids: mappedFaceSheetIds });

          const { error: fsMappingError } = await supabase
            .from('loadlist_face_sheets')
            .insert(loadlistFaceSheetsData);

          if (fsMappingError) {
            console.error('Failed to link mapped face sheets:', fsMappingError);
            // ไม่ต้อง rollback เพราะเป็น optional mapping
          }
        }

        // ✅ NEW: บันทึก picklist_id ลง loadlist ถ้ามี
        const mappedPicklistIds = bonus_face_sheet_mappings
          .filter((m: any) => m.picklist_id)
          .map((m: any) => m.picklist_id);

        if (mappedPicklistIds.length > 0) {
          // ดึง trip_id จาก picklist ที่เลือก
          const { data: selectedPicklist } = await supabase
            .from('picklists')
            .select('trip_id')
            .eq('id', mappedPicklistIds[0])
            .single();

          if (selectedPicklist?.trip_id) {
            // อัปเดต loadlist ให้มี trip_id
            await supabase
              .from('loadlists')
              .update({ trip_id: selectedPicklist.trip_id })
              .eq('id', loadlist.id);

            console.log('✅ Updated loadlist with trip_id:', selectedPicklist.trip_id);
          }

          // Link picklist to loadlist
          const loadlistPicklistsData = mappedPicklistIds.map((picklist_id: number) => ({
            loadlist_id: loadlist.id,
            picklist_id: picklist_id
          }));

          console.log('🔗 Linking mapped picklists to loadlist:', { loadlist_id: loadlist.id, picklist_ids: mappedPicklistIds });

          const { error: plMappingError } = await supabase
            .from('wms_loadlist_picklists')
            .insert(loadlistPicklistsData);

          if (plMappingError) {
            console.error('Failed to link mapped picklists:', plMappingError);
            // ไม่ต้อง rollback เพราะเป็น optional mapping
          }
        }
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

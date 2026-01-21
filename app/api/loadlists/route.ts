import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * ✅ NEW (edit28): Helper function สำหรับสร้าง loadlist จาก BFS โดยไม่ต้องแมพกับ picklist
 * ✅ NEW: รองรับการเลือกเฉพาะบางออเดอร์จาก BFS
 * - ดึง packages ทั้งหมดของ BFS ที่เลือก (ที่ยังไม่ถูกแมพ)
 * - ถ้ามี selected_orders จะกรองเฉพาะ packages ของออเดอร์ที่เลือก
 * - สร้าง loadlist 1 ใบ
 * - บันทึก mapping ใน wms_loadlist_bonus_face_sheets พร้อม matched_package_ids
 */
async function handleSkipMappingMode(
  supabase: SupabaseClient,
  params: {
    bfs_ids: number[];
    checker_employee_id: number;
    vehicle_type: string;
    delivery_number: string;
    vehicle_id?: number | null;
    driver_employee_id?: number | null;
    driver_phone?: string | null;
    helper_employee_id?: number | null;
    loading_queue_number?: string | null;
    loading_door_number?: string | null;
    selected_orders?: Record<number, string[]>; // ✅ NEW: bfs_id -> order_no[]
  }
) {
  const {
    bfs_ids,
    checker_employee_id,
    vehicle_type,
    delivery_number,
    vehicle_id,
    driver_employee_id,
    driver_phone,
    helper_employee_id,
    loading_queue_number,
    loading_door_number,
    selected_orders
  } = params;

  try {
    // Validate required fields
    if (!checker_employee_id) {
      return NextResponse.json({ error: 'checker_employee_id is required' }, { status: 400 });
    }
    // ✅ FIX (edit33): ไม่บังคับ vehicle_type และ delivery_number สำหรับโหมด skip_mapping
    // ใช้ค่า default แทน
    const effectiveVehicleType = vehicle_type || 'N/A';
    const effectiveDeliveryNumber = delivery_number || `BFS-${Date.now()}`;

    // 1. ดึง matched_package_ids ที่ถูกใช้แล้วจากทุก loadlist
    const { data: usedMappings } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, matched_package_ids')
      .in('bonus_face_sheet_id', bfs_ids)
      .not('matched_package_ids', 'is', null);

    const usedPackagesByBFS = new Map<number, Set<number>>();
    usedMappings?.forEach(m => {
      const bfsId = m.bonus_face_sheet_id;
      if (!usedPackagesByBFS.has(bfsId)) {
        usedPackagesByBFS.set(bfsId, new Set());
      }
      (m.matched_package_ids || []).forEach((id: number) => usedPackagesByBFS.get(bfsId)!.add(id));
    });

    // 2. ดึง packages ทั้งหมดของ BFS ที่เลือก (ที่ยังไม่ถูกแมพ)
    const { data: allPackages, error: pkgError } = await supabase
      .from('bonus_face_sheet_packages')
      .select('id, face_sheet_id, order_id')
      .in('face_sheet_id', bfs_ids)
      .not('storage_location', 'is', null);

    if (pkgError) {
      return NextResponse.json(
        { error: 'Failed to fetch packages', details: pkgError.message },
        { status: 500 }
      );
    }

    // ✅ NEW: ถ้ามี selected_orders ให้ดึง order_no จาก wms_orders เพื่อกรอง packages
    let orderIdsByOrderNo = new Map<string, number>();
    if (selected_orders && Object.keys(selected_orders).length > 0) {
      // รวบรวม order_no ทั้งหมดที่เลือก
      const allSelectedOrderNos = Object.values(selected_orders).flat();
      
      if (allSelectedOrderNos.length > 0) {
        const { data: orders } = await supabase
          .from('wms_orders')
          .select('order_id, order_no')
          .in('order_no', allSelectedOrderNos);

        orders?.forEach(order => {
          orderIdsByOrderNo.set(order.order_no, order.order_id);
        });
      }
    }

    // กรองเฉพาะ packages ที่ยังไม่ถูกใช้
    let availablePackages = (allPackages || []).filter(pkg => {
      const usedPackages = usedPackagesByBFS.get(pkg.face_sheet_id);
      return !usedPackages || !usedPackages.has(pkg.id);
    });

    // ✅ NEW: กรองเฉพาะ packages ของออเดอร์ที่เลือก (ถ้ามี selected_orders)
    if (selected_orders && Object.keys(selected_orders).length > 0) {
      availablePackages = availablePackages.filter(pkg => {
        const bfsId = pkg.face_sheet_id;
        const selectedOrderNos = selected_orders[bfsId] || [];
        
        // ถ้าไม่มีการเลือกออเดอร์สำหรับ BFS นี้ ให้เอาทั้งหมด
        if (selectedOrderNos.length === 0) {
          return true;
        }
        
        // กรองเฉพาะ packages ที่อยู่ในออเดอร์ที่เลือก
        const selectedOrderIds = selectedOrderNos
          .map(orderNo => orderIdsByOrderNo.get(orderNo))
          .filter(Boolean);
        
        return selectedOrderIds.includes(pkg.order_id);
      });
    }

    if (availablePackages.length === 0) {
      return NextResponse.json(
        { error: 'ไม่มี packages ที่พร้อมใช้งาน', details: 'BFS ที่เลือกไม่มี packages ที่ยังไม่ถูกแมพ หรือไม่มีออเดอร์ที่เลือก' },
        { status: 400 }
      );
    }

    // จัดกลุ่ม packages ตาม BFS
    const packagesByBFS = new Map<number, number[]>();
    availablePackages.forEach(pkg => {
      const existing = packagesByBFS.get(pkg.face_sheet_id) || [];
      existing.push(pkg.id);
      packagesByBFS.set(pkg.face_sheet_id, existing);
    });

    // 3. ✅ FIX: ใช้ plan_date จาก picklist ที่แมพ (ถ้ามี) หรือ delivery_date จาก BFS
    // เพราะ loadlist ควรใช้เลขตามวันที่กำหนดส่งของ ไม่ใช่วันที่สร้าง loadlist
    let datePrefix: string;
    
    // ลองหา plan_date จาก picklist ที่แมพกับ BFS
    const { data: mappedPicklist } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        mapped_picklist_id,
        picklists:mapped_picklist_id (
          trip_id,
          receiving_route_trips!inner (
            plan_id,
            receiving_route_plans!inner (
              plan_date
            )
          )
        )
      `)
      .in('bonus_face_sheet_id', bfs_ids)
      .not('mapped_picklist_id', 'is', null)
      .limit(1)
      .single();

    const picklists = mappedPicklist?.picklists as any;
    if (picklists?.receiving_route_trips?.receiving_route_plans?.plan_date) {
      // ใช้ plan_date จาก route plan
      datePrefix = picklists.receiving_route_trips.receiving_route_plans.plan_date.replace(/-/g, '');
    } else {
      // ถ้าไม่มี picklist ให้ใช้ delivery_date จาก BFS แรก
      const { data: firstBfs } = await supabase
        .from('bonus_face_sheets')
        .select('delivery_date')
        .eq('id', bfs_ids[0])
        .single();

      if (firstBfs?.delivery_date) {
        datePrefix = firstBfs.delivery_date.replace(/-/g, '');
      } else {
        // ถ้าไม่มีทั้ง 2 อย่าง ใช้วันที่ปัจจุบัน
        const today = new Date();
        datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      }
    }

    const { data: latestLoadlist } = await supabase
      .from('loadlists')
      .select('loadlist_code')
      .like('loadlist_code', `LD-${datePrefix}-%`)
      .order('loadlist_code', { ascending: false })
      .limit(1)
      .single();

    let sequenceNumber = 1;
    if (latestLoadlist?.loadlist_code) {
      const lastSequence = latestLoadlist.loadlist_code.split('-')[2];
      if (lastSequence) {
        sequenceNumber = parseInt(lastSequence, 10) + 1;
      }
    }

    const loadlistCode = `LD-${datePrefix}-${String(sequenceNumber).padStart(4, '0')}`;

    // 5. สร้าง loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .insert({
        loadlist_code: loadlistCode,
        plan_id: null,
        trip_id: null,
        status: 'pending',
        checker_employee_id,
        vehicle_type: effectiveVehicleType,
        delivery_number: effectiveDeliveryNumber,
        vehicle_id: vehicle_id || null,
        driver_employee_id: driver_employee_id || null,
        driver_phone: driver_phone || null,
        helper_employee_id: helper_employee_id || null,
        loading_queue_number: loading_queue_number || null,
        loading_door_number: loading_door_number || null,
        created_by: null
      })
      .select()
      .single();

    if (loadlistError) {
      return NextResponse.json(
        { error: 'Failed to create loadlist', details: loadlistError.message },
        { status: 500 }
      );
    }

    // 6. สร้าง mapping records สำหรับแต่ละ BFS
    let totalPackagesCount = 0;
    for (const bfsId of bfs_ids) {
      const packageIds = packagesByBFS.get(bfsId) || [];
      
      if (packageIds.length === 0) continue;
      
      totalPackagesCount += packageIds.length;

      const { error: linkError } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .insert({
          loadlist_id: loadlist.id,
          bonus_face_sheet_id: bfsId,
          mapping_type: 'direct', // ✅ NEW: บอกว่าเป็นการสร้างโดยตรง ไม่ได้แมพกับ picklist
          mapped_picklist_id: null,
          mapped_face_sheet_id: null,
          matched_package_ids: packageIds
        });

      if (linkError) {
        // Cleanup
        await supabase.from('loadlists').delete().eq('id', loadlist.id);
        return NextResponse.json(
          { error: 'Failed to link bonus face sheet to loadlist', details: linkError.message },
          { status: 500 }
        );
      }
    }

    console.log(`[skip_mapping] Created loadlist ${loadlistCode} with ${totalPackagesCount} packages from ${bfs_ids.length} BFS`);

    return NextResponse.json({
      success: true,
      loadlist_id: loadlist.id,
      loadlist_code: loadlist.loadlist_code,
      packages_count: totalPackagesCount,
      bfs_count: bfs_ids.length,
      mode: 'skip_mapping'
    });

  } catch (error: any) {
    console.error('[skip_mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // ✅ PAGINATION: เพิ่ม page parameter
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
          mapped_picklist_id,
          mapped_face_sheet_id,
          mapping_type,
          matched_package_ids,
          bonus_face_sheets:bonus_face_sheet_id (
            face_sheet_no,
            status,
            total_packages,
            total_items,
            total_orders
          )
        )
      `)
      .order('created_at', { ascending: false })
      ;

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

    // ✅ FIX (edit03): ดึงเลขเอกสาร Picklist และ Face Sheet ที่ถูกแมพจาก BFS
    // รวบรวม mapped_picklist_ids และ mapped_face_sheet_ids จากทุก loadlist
    const mappedPicklistIds: number[] = [];
    const mappedFaceSheetIds: number[] = [];
    
    loadlists?.forEach((loadlist: any) => {
      const bfsMappings = loadlist.wms_loadlist_bonus_face_sheets || [];
      bfsMappings.forEach((mapping: any) => {
        if (mapping.mapped_picklist_id) {
          mappedPicklistIds.push(mapping.mapped_picklist_id);
        }
        if (mapping.mapped_face_sheet_id) {
          mappedFaceSheetIds.push(mapping.mapped_face_sheet_id);
        }
      });
    });

    // ดึงเลข Picklist ที่แมพ
    let mappedPicklistMap: Record<number, string> = {};
    if (mappedPicklistIds.length > 0) {
      const { data: picklists } = await supabase
        .from('picklists')
        .select('id, picklist_code')
        .in('id', [...new Set(mappedPicklistIds)]);

      picklists?.forEach((pl: any) => {
        mappedPicklistMap[pl.id] = pl.picklist_code;
      });
    }

    // ✅ FIX: ดึง bonus_face_sheets data แยก (เพราะ nested relation อาจไม่ทำงาน)
    const allBfsIds: number[] = [];
    loadlists?.forEach((loadlist: any) => {
      const bfsMappings = loadlist.wms_loadlist_bonus_face_sheets || [];
      bfsMappings.forEach((mapping: any) => {
        if (mapping.bonus_face_sheet_id) {
          allBfsIds.push(mapping.bonus_face_sheet_id);
        }
      });
    });

    let bfsDataMap: Record<number, any> = {};
    if (allBfsIds.length > 0) {
      const { data: bfsData } = await supabase
        .from('bonus_face_sheets')
        .select('id, face_sheet_no, status, total_packages, total_items, total_orders')
        .in('id', [...new Set(allBfsIds)]);

      bfsData?.forEach((bfs: any) => {
        bfsDataMap[bfs.id] = bfs;
      });
    }

    // ดึงเลข Face Sheet ที่แมพ
    let mappedFaceSheetMap: Record<number, string> = {};
    if (mappedFaceSheetIds.length > 0) {
      const { data: faceSheets } = await supabase
        .from('face_sheets')
        .select('id, face_sheet_no')
        .in('id', [...new Set(mappedFaceSheetIds)]);

      faceSheets?.forEach((fs: any) => {
        mappedFaceSheetMap[fs.id] = fs.face_sheet_no;
      });
    }

    // ✅ FIX (edit09): ดึง related_bfs_loadlists สำหรับ loadlist ที่สร้างจาก trip/picklist
    // หา order_no จาก BFS loadlist ที่แมพกับ picklist เดียวกัน
    const relatedBfsOrdersMap: Record<number, string[]> = {};
    
    // รวบรวม picklist_ids จากทุก loadlist (ทั้งจาก wms_loadlist_picklists และ trip_id)
    const allPicklistIds: number[] = [];
    const loadlistPicklistMap: Record<number, number[]> = {}; // loadlist_id -> picklist_ids
    
    loadlists?.forEach((loadlist: any) => {
      const picklistIds: number[] = [];
      
      // จาก wms_loadlist_picklists
      const linkedPicklists = loadlist.wms_loadlist_picklists || [];
      linkedPicklists.forEach((lp: any) => {
        if (lp.picklist_id) {
          picklistIds.push(lp.picklist_id);
          allPicklistIds.push(lp.picklist_id);
        }
      });
      
      loadlistPicklistMap[loadlist.id] = picklistIds;
    });

    // ดึง picklist_ids จาก trip_id (สำหรับ loadlist ที่มี trip_id แต่ไม่มี wms_loadlist_picklists)
    const tripIdsForPicklists = loadlists
      ?.filter((l: any) => l.trip_id && (!loadlistPicklistMap[l.id] || loadlistPicklistMap[l.id].length === 0))
      .map((l: any) => l.trip_id) || [];

    if (tripIdsForPicklists.length > 0) {
      const { data: picklistsFromTrips } = await supabase
        .from('picklists')
        .select('id, trip_id')
        .in('trip_id', tripIdsForPicklists);

      picklistsFromTrips?.forEach((p: any) => {
        // หา loadlist ที่มี trip_id ตรงกัน
        loadlists?.forEach((loadlist: any) => {
          if (loadlist.trip_id === p.trip_id) {
            if (!loadlistPicklistMap[loadlist.id]) {
              loadlistPicklistMap[loadlist.id] = [];
            }
            if (!loadlistPicklistMap[loadlist.id].includes(p.id)) {
              loadlistPicklistMap[loadlist.id].push(p.id);
              allPicklistIds.push(p.id);
            }
          }
        });
      });
    }

    // ✅ FIX (edit34): หา BFS loadlist ที่แมพกับ picklist เหล่านี้ และดึง order_no
    // เฉพาะ loadlist ที่ status = 'pending' เท่านั้น
    if (allPicklistIds.length > 0) {
      const { data: bfsLoadlistMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
          loadlist_id,
          mapped_picklist_id,
          bonus_face_sheet_id,
          matched_package_ids,
          loadlists!inner (
            status
          )
        `)
        .in('mapped_picklist_id', [...new Set(allPicklistIds)])
        .eq('loadlists.status', 'pending'); // ✅ FIX: กรองเฉพาะ pending

      if (bfsLoadlistMappings && bfsLoadlistMappings.length > 0) {
        // รวบรวม bonus_face_sheet_ids
        const bfsIds = [...new Set(bfsLoadlistMappings.map((m: any) => m.bonus_face_sheet_id))];
        
        // ดึง packages จาก bonus_face_sheets พร้อม order_id
        const { data: bfsPackages } = await supabase
          .from('bonus_face_sheet_packages')
          .select('id, face_sheet_id, order_id')
          .in('face_sheet_id', bfsIds);

        // ดึง order_no จาก wms_orders
        const orderIds = [...new Set(bfsPackages?.map((p: any) => p.order_id).filter(Boolean) || [])];
        let orderNoMap: Record<number, string> = {};
        
        if (orderIds.length > 0) {
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('order_id, order_no')
            .in('order_id', orderIds);

          orders?.forEach((o: any) => {
            orderNoMap[o.order_id] = o.order_no;
          });
        }

        // สร้าง mapping: picklist_id -> order_nos (จาก BFS ที่แมพ)
        const picklistToBfsOrders: Record<number, string[]> = {};
        
        bfsLoadlistMappings.forEach((m: any) => {
          if (!picklistToBfsOrders[m.mapped_picklist_id]) {
            picklistToBfsOrders[m.mapped_picklist_id] = [];
          }
          
          // ✅ FIX (edit34): หา packages ที่อยู่ใน matched_package_ids เท่านั้น
          const matchedPackageIds = m.matched_package_ids || [];
          
          // ถ้าไม่มี matched_package_ids ให้ข้าม (ไม่เอาทั้งหมด)
          if (matchedPackageIds.length === 0) {
            return;
          }
          
          const packagesInBfs = bfsPackages?.filter((p: any) => 
            p.face_sheet_id === m.bonus_face_sheet_id &&
            matchedPackageIds.includes(p.id) // ✅ FIX: เอาเฉพาะที่อยู่ใน matched_package_ids
          ) || [];

          // ดึง order_no จาก packages
          packagesInBfs.forEach((pkg: any) => {
            const orderNo = orderNoMap[pkg.order_id];
            if (orderNo && !picklistToBfsOrders[m.mapped_picklist_id].includes(orderNo)) {
              picklistToBfsOrders[m.mapped_picklist_id].push(orderNo);
            }
          });
        });

        // สร้าง relatedBfsOrdersMap สำหรับแต่ละ loadlist
        Object.entries(loadlistPicklistMap).forEach(([loadlistIdStr, picklistIds]) => {
          const loadlistId = parseInt(loadlistIdStr, 10);
          const relatedOrders: string[] = [];
          
          picklistIds.forEach((picklistId: number) => {
            const orders = picklistToBfsOrders[picklistId] || [];
            orders.forEach(orderNo => {
              if (!relatedOrders.includes(orderNo)) {
                relatedOrders.push(orderNo);
              }
            });
          });

          if (relatedOrders.length > 0) {
            relatedBfsOrdersMap[loadlistId] = relatedOrders.sort();
          }
        });
      }
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
        bfs_confirmed_to_staging: loadlist.bfs_confirmed_to_staging, // ✅ NEW: เพิ่ม field สำหรับ BFS confirmation
        vehicle: vehicle,
        driver: driver,
        face_sheets: faceSheets.map((fs: any) => ({
          id: fs.face_sheet_id,
          face_sheet_no: fs.face_sheets?.face_sheet_no,
          status: fs.face_sheets?.status,
          total_packages: fs.face_sheets?.total_packages,
          total_items: fs.face_sheets?.total_items
        })),
        bonus_face_sheets: bonusFaceSheets.map((bfs: any) => {
          // ✅ FIX: ใช้ bfsDataMap แทน nested relation
          const bfsData = bfsDataMap[bfs.bonus_face_sheet_id] || bfs.bonus_face_sheets || {};
          return {
            id: bfs.bonus_face_sheet_id,
            face_sheet_no: bfsData.face_sheet_no,
            status: bfsData.status,
            total_packages: bfsData.total_packages,
            total_items: bfsData.total_items,
            total_orders: bfsData.total_orders,
            // ✅ FIX (edit03): เพิ่ม mapping info
            mapping_type: bfs.mapping_type,
            mapped_picklist_id: bfs.mapped_picklist_id,
            mapped_face_sheet_id: bfs.mapped_face_sheet_id,
            matched_package_count: bfs.matched_package_ids?.length || 0
          };
        }),
        // ✅ FIX (edit03): เพิ่ม mapped_documents สำหรับแสดงในตาราง
        mapped_documents: bonusFaceSheets
          .filter((bfs: any) => bfs.mapping_type && (bfs.mapped_picklist_id || bfs.mapped_face_sheet_id))
          .map((bfs: any) => {
            if (bfs.mapping_type === 'picklist' && bfs.mapped_picklist_id) {
              return {
                type: 'picklist' as const,
                code: mappedPicklistMap[bfs.mapped_picklist_id] || `PL-${bfs.mapped_picklist_id}`,
                id: bfs.mapped_picklist_id,
                matched_package_count: bfs.matched_package_ids?.length || 0
              };
            } else if (bfs.mapping_type === 'face_sheet' && bfs.mapped_face_sheet_id) {
              return {
                type: 'face_sheet' as const,
                code: mappedFaceSheetMap[bfs.mapped_face_sheet_id] || `FS-${bfs.mapped_face_sheet_id}`,
                id: bfs.mapped_face_sheet_id,
                matched_package_count: bfs.matched_package_ids?.length || 0
              };
            }
            return null;
          })
          .filter(Boolean),
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
        }),
        // ✅ FIX (edit09): เพิ่ม related_bfs_orders - order_no จาก BFS ที่แมพกับ picklist เดียวกัน
        related_bfs_orders: relatedBfsOrdersMap[loadlist.id] || []
      };
    });

    // ✅ PAGINATION: Return with pagination metadata
    return NextResponse.json({
      data: transformedLoadlists
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      picklist_ids,
      face_sheet_ids,
      bonus_face_sheet_ids,
      bonus_face_sheet_mappings, // ✅ NEW: รับ mapping ของ bonus face sheet กับ picklist และ face sheet
      skip_mapping, // ✅ NEW (edit28): สร้าง loadlist จาก BFS โดยไม่ต้องแมพกับ picklist
      bfs_ids, // ✅ NEW (edit28): รายการ BFS IDs เมื่อ skip_mapping = true
      selected_orders, // ✅ NEW: รายการออเดอร์ที่เลือกสำหรับแต่ละ BFS (bfs_id -> order_no[])
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

    // ✅ NEW (edit28): โหมดไม่แมพ - สร้าง loadlist จาก BFS โดยตรง
    if (skip_mapping && bfs_ids && Array.isArray(bfs_ids) && bfs_ids.length > 0) {
      return await handleSkipMappingMode(supabase, {
        bfs_ids,
        checker_employee_id,
        vehicle_type,
        delivery_number,
        vehicle_id,
        driver_employee_id,
        driver_phone,
        helper_employee_id,
        loading_queue_number,
        loading_door_number,
        selected_orders // ✅ NEW: ส่ง selected_orders ไปด้วย
      });
    }

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

    // ✅ NEW (BUG010): ตรวจสอบว่า picklist ถูกแมพกับ loadlist อื่นแล้วหรือไม่
    if (hasPicklists) {
      const { data: existingPicklistMappings } = await supabase
        .from('wms_loadlist_picklists')
        .select(`
          picklist_id,
          loadlist_id,
          loadlists!inner(loadlist_code, status)
        `)
        .in('picklist_id', picklist_ids);

      if (existingPicklistMappings && existingPicklistMappings.length > 0) {
        const mappedPicklists = existingPicklistMappings.map((m: any) => ({
          picklist_id: m.picklist_id,
          loadlist_code: m.loadlists?.loadlist_code,
          loadlist_status: m.loadlists?.status
        }));

        return NextResponse.json({
          error: 'Picklist ถูกแมพกับ loadlist อื่นแล้ว',
          details: 'ไม่สามารถสร้าง loadlist ได้เพราะ picklist ถูกใช้ไปแล้ว',
          existing_mappings: mappedPicklists
        }, { status: 400 });
      }
    }

    // ✅ NEW (BUG010): ตรวจสอบว่า face sheet ถูกแมพกับ loadlist อื่นแล้วหรือไม่
    if (hasFaceSheets) {
      const { data: existingFaceSheetMappings } = await supabase
        .from('loadlist_face_sheets')
        .select(`
          face_sheet_id,
          loadlist_id,
          loadlists!inner(loadlist_code, status)
        `)
        .in('face_sheet_id', face_sheet_ids);

      if (existingFaceSheetMappings && existingFaceSheetMappings.length > 0) {
        const mappedFaceSheets = existingFaceSheetMappings.map((m: any) => ({
          face_sheet_id: m.face_sheet_id,
          loadlist_code: m.loadlists?.loadlist_code,
          loadlist_status: m.loadlists?.status
        }));

        return NextResponse.json({
          error: 'Face Sheet ถูกแมพกับ loadlist อื่นแล้ว',
          details: 'ไม่สามารถสร้าง loadlist ได้เพราะ face sheet ถูกใช้ไปแล้ว',
          existing_mappings: mappedFaceSheets
        }, { status: 400 });
      }
    }

    // ✅ FIX (edit09): จัดกลุ่ม BFS ตามเอกสารที่แมพ และสร้าง loadlist ตามกลุ่ม
    if (hasBonusFaceSheets && bonus_face_sheet_mappings && bonus_face_sheet_mappings.length > 0) {
      // จัดกลุ่ม BFS ตามเอกสารที่แมพ
      const groupedByMapping: Record<string, {
        mapping_type: 'picklist' | 'face_sheet';
        mapped_picklist_id: number | null;
        mapped_face_sheet_id: number | null;
        bfs_list: number[];
      }> = {};

      for (const mapping of bonus_face_sheet_mappings) {
        // สร้าง key จากเอกสารที่แมพ
        const mappingKey = mapping.picklist_id 
          ? `picklist_${mapping.picklist_id}`
          : `face_sheet_${mapping.face_sheet_id}`;
        
        if (!groupedByMapping[mappingKey]) {
          groupedByMapping[mappingKey] = {
            mapping_type: mapping.picklist_id ? 'picklist' : 'face_sheet',
            mapped_picklist_id: mapping.picklist_id || null,
            mapped_face_sheet_id: mapping.face_sheet_id || null,
            bfs_list: []
          };
        }
        
        groupedByMapping[mappingKey].bfs_list.push(mapping.bonus_face_sheet_id);
      }

      // สร้าง loadlist ตามกลุ่ม (1 loadlist ต่อ 1 เอกสารที่แมพ)
      const createdLoadlists = [];

      for (const [mappingKey, group] of Object.entries(groupedByMapping)) {
        // Helper function: คำนวณ matched_package_ids สำหรับ BFS
        const getMatchedPackageIds = async (bfsId: number): Promise<number[]> => {
          // ดึง matched_package_ids ที่ถูกใช้แล้วจากทุก loadlist
          const { data: usedMappings } = await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .select('matched_package_ids')
            .eq('bonus_face_sheet_id', bfsId)
            .not('matched_package_ids', 'is', null);

          const usedPackageIds = new Set<number>();
          usedMappings?.forEach(m => {
            (m.matched_package_ids || []).forEach((id: number) => usedPackageIds.add(id));
          });

          // ดึง packages จาก BFS (เฉพาะที่ยังไม่ถูกแมพ)
          const { data: allBfsPackages } = await supabase
            .from('bonus_face_sheet_packages')
            .select('id, customer_id, order_id')
            .eq('face_sheet_id', bfsId)
            .not('storage_location', 'is', null);

          const bfsPackages = (allBfsPackages || []).filter(pkg => !usedPackageIds.has(pkg.id));

          if (bfsPackages.length === 0) {
            return [];
          }

          // ดึง customer_id จาก wms_orders ผ่าน order_id
          const bfsOrderIds = [...new Set(bfsPackages.map(pkg => pkg.order_id).filter(Boolean))];
          
          let orderCustomerMap: Record<number, string> = {};
          if (bfsOrderIds.length > 0) {
            const { data: bfsOrders } = await supabase
              .from('wms_orders')
              .select('order_id, customer_id')
              .in('order_id', bfsOrderIds);
            
            bfsOrders?.forEach(o => {
              if (o.customer_id) {
                orderCustomerMap[o.order_id] = o.customer_id;
              }
            });
          }

          // เพิ่ม effective_customer_id ให้กับ packages
          const bfsPackagesWithCustomer = bfsPackages.map(pkg => ({
            ...pkg,
            effective_customer_id: pkg.customer_id || (pkg.order_id ? orderCustomerMap[pkg.order_id] : null)
          }));

          const bfsCustomerIds = [...new Set(
            bfsPackagesWithCustomer.map(pkg => pkg.effective_customer_id).filter(Boolean) || []
          )];

          // ดึง customer_ids จากเอกสารที่แมพ
          let targetCustomerIds: string[] = [];

          if (group.mapped_picklist_id) {
            const { data: picklistItems } = await supabase
              .from('picklist_items')
              .select('order_id')
              .eq('picklist_id', group.mapped_picklist_id);

            const orderIds = [...new Set(picklistItems?.map(item => item.order_id).filter(Boolean) || [])];
            
            if (orderIds.length > 0) {
              const { data: orders } = await supabase
                .from('wms_orders')
                .select('customer_id')
                .in('order_id', orderIds);

              targetCustomerIds = [...new Set(orders?.map(o => o.customer_id).filter(Boolean) || [])];
            }
          } else if (group.mapped_face_sheet_id) {
            const { data: fsPackages } = await supabase
              .from('face_sheet_packages')
              .select('customer_id')
              .eq('face_sheet_id', group.mapped_face_sheet_id);

            targetCustomerIds = [...new Set(fsPackages?.map(pkg => pkg.customer_id).filter(Boolean) || [])];
          }

          const matchedCustomerIds = bfsCustomerIds.filter(id => targetCustomerIds.includes(id as string));
          
          return bfsPackagesWithCustomer
            .filter(pkg => pkg.effective_customer_id && matchedCustomerIds.includes(pkg.effective_customer_id))
            .map(pkg => pkg.id);
        };

        // 1. คำนวณ matched_package_ids รวมจากทุก BFS ในกลุ่ม (สำหรับ validation)
        let allMatchedPackageIds: number[] = [];
        const bfsMatchedMap: Record<number, number[]> = {};
        
        for (const bfsId of group.bfs_list) {
          const matchedIds = await getMatchedPackageIds(bfsId);
          bfsMatchedMap[bfsId] = matchedIds;
          allMatchedPackageIds.push(...matchedIds);
        }
        
        // 2. ตรวจสอบว่ามี matched packages หรือไม่
        if (allMatchedPackageIds.length === 0) {
          return NextResponse.json(
            { 
              error: 'ไม่พบรหัสลูกค้าที่ตรงกัน ไม่สามารถสร้างใบโหลดได้',
              details: `ไม่มี customer_id ที่ตรงกับ ${group.mapping_type === 'picklist' ? 'Picklist' : 'Face Sheet'} ที่เลือก`
            },
            { status: 400 }
          );
        }

        // 3. Generate loadlist code
        let datePrefix: string;
        let deliveryDate: string | null = null;
        
        // ดึง delivery_date จาก bonus face sheet
        const { data: bonusFaceSheet } = await supabase
          .from('bonus_face_sheets')
          .select('delivery_date')
          .eq('id', group.bfs_list[0])
          .single();
        
        if (bonusFaceSheet?.delivery_date) {
          deliveryDate = bonusFaceSheet.delivery_date;
        }
        
        if (deliveryDate) {
          datePrefix = deliveryDate.replace(/-/g, '');
        } else {
          const today = new Date();
          datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        }

        const { data: latestLoadlist } = await supabase
          .from('loadlists')
          .select('loadlist_code')
          .like('loadlist_code', `LD-${datePrefix}-%`)
          .order('loadlist_code', { ascending: false })
          .limit(1)
          .single();

        let sequenceNumber = 1;
        if (latestLoadlist && latestLoadlist.loadlist_code) {
          const lastSequence = latestLoadlist.loadlist_code.split('-')[2];
          if (lastSequence) {
            sequenceNumber = parseInt(lastSequence, 10) + 1;
          }
        }

        const loadlistCode = `LD-${datePrefix}-${String(sequenceNumber).padStart(4, '0')}`;

        // 4. ดึง trip_id จาก picklist (ถ้าแมพกับ picklist)
        let trip_id = null;
        if (group.mapped_picklist_id) {
          const { data: selectedPicklist } = await supabase
            .from('picklists')
            .select('trip_id')
            .eq('id', group.mapped_picklist_id)
            .single();

          if (selectedPicklist?.trip_id) {
            trip_id = selectedPicklist.trip_id;
          }
        }

        // 5. สร้าง loadlist 1 ใบ
        const { data: loadlist, error: loadlistError } = await supabase
          .from('loadlists')
          .insert({
            loadlist_code: loadlistCode,
            plan_id: null,
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
            created_by: null
          })
          .select()
          .single();

        if (loadlistError) {
          return NextResponse.json(
            { error: 'Failed to create loadlist', details: loadlistError.message },
            { status: 500 }
          );
        }

        // 6. Link picklist to loadlist (ถ้าแมพกับ picklist)
        if (group.mapped_picklist_id) {
          await supabase
            .from('wms_loadlist_picklists')
            .insert({ loadlist_id: loadlist.id, picklist_id: group.mapped_picklist_id });
        }

        // 7. Link face sheet to loadlist (ถ้าแมพกับ face sheet)
        if (group.mapped_face_sheet_id) {
          await supabase
            .from('loadlist_face_sheets')
            .insert({ loadlist_id: loadlist.id, face_sheet_id: group.mapped_face_sheet_id });
        }

        // 8. สร้าง mapping records สำหรับแต่ละ BFS
        for (const bfsId of group.bfs_list) {
          const matchedIds = bfsMatchedMap[bfsId];
          
          const { error: linkError } = await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .insert({
              loadlist_id: loadlist.id,
              bonus_face_sheet_id: bfsId,
              mapping_type: group.mapping_type,
              mapped_picklist_id: group.mapped_picklist_id,
              mapped_face_sheet_id: group.mapped_face_sheet_id,
              matched_package_ids: matchedIds.length > 0 ? matchedIds : null
            });

          if (linkError) {
            await supabase.from('loadlists').delete().eq('id', loadlist.id);
            return NextResponse.json(
              { error: 'Failed to link bonus face sheet to loadlist', details: linkError.message },
              { status: 500 }
            );
          }
        }

        createdLoadlists.push(loadlist);
      }

      // Return ผลลัพธ์
      return NextResponse.json({ 
        success: true, 
        loadlists: createdLoadlists,
        message: `สร้างใบโหลด ${createdLoadlists.length} ใบ`
      });
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

    // Create loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .insert(insertData)
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
      // ✅ UPDATED: รองรับ customer_id matching และ exclusive mapping
      for (const bonus_face_sheet_id of bonus_face_sheet_ids) {
        // หา mapping สำหรับ BFS นี้
        const mapping = bonus_face_sheet_mappings?.find(
          (m: any) => m.bonus_face_sheet_id === bonus_face_sheet_id
        );

        let mappedPicklistId: number | null = null;
        let mappedFaceSheetId: number | null = null;
        let matchedPackageIds: number[] = [];
        let mappingType: string | null = null;

        if (mapping) {
          // ตรวจสอบว่าเลือกได้แค่อย่างเดียว
          if (mapping.picklist_id && mapping.face_sheet_id) {
            await supabase.from('loadlists').delete().eq('id', loadlist.id);
            return NextResponse.json(
              { error: 'Cannot map BFS to both Picklist and Face Sheet. Please select only one.' },
              { status: 400 }
            );
          }

          // ✅ FIX (edit02): ดึง matched_package_ids ที่ถูกใช้แล้วจากทุก loadlist
          const { data: usedMappings } = await supabase
            .from('wms_loadlist_bonus_face_sheets')
            .select('matched_package_ids')
            .eq('bonus_face_sheet_id', bonus_face_sheet_id)
            .not('matched_package_ids', 'is', null);

          const usedPackageIds = new Set<number>();
          usedMappings?.forEach(m => {
            (m.matched_package_ids || []).forEach((id: number) => usedPackageIds.add(id));
          });

          // ดึง packages จาก BFS (เฉพาะที่ยังไม่ถูกแมพ)
          const { data: allBfsPackages } = await supabase
            .from('bonus_face_sheet_packages')
            .select('id, customer_id, order_id')
            .eq('face_sheet_id', bonus_face_sheet_id)
            .not('storage_location', 'is', null);

          // ✅ FIX (edit02): กรองเฉพาะ packages ที่ยังไม่ถูกใช้
          const bfsPackages = (allBfsPackages || []).filter(pkg => !usedPackageIds.has(pkg.id));

          if (bfsPackages.length === 0) {
            await supabase.from('loadlists').delete().eq('id', loadlist.id);
            return NextResponse.json(
              { 
                error: 'ไม่มี packages ที่พร้อมใช้งาน',
                details: `BFS ${bonus_face_sheet_id} ไม่มี packages ที่ยังไม่ถูกแมพ`
              },
              { status: 400 }
            );
          }

          // ✅ FIX (edit04): ดึง customer_id จาก wms_orders ผ่าน order_id
          // เพราะ bonus_face_sheet_packages.customer_id อาจเป็น null
          const bfsOrderIds = [...new Set(bfsPackages.map(pkg => pkg.order_id).filter(Boolean))];
          
          let orderCustomerMap: Record<number, string> = {};
          if (bfsOrderIds.length > 0) {
            const { data: bfsOrders } = await supabase
              .from('wms_orders')
              .select('order_id, customer_id')
              .in('order_id', bfsOrderIds);
            
            bfsOrders?.forEach(o => {
              if (o.customer_id) {
                orderCustomerMap[o.order_id] = o.customer_id;
              }
            });
          }

          // เพิ่ม effective_customer_id ให้กับ packages
          const bfsPackagesWithCustomer = bfsPackages.map(pkg => ({
            ...pkg,
            effective_customer_id: pkg.customer_id || (pkg.order_id ? orderCustomerMap[pkg.order_id] : null)
          }));

          const bfsCustomerIds = [...new Set(
            bfsPackagesWithCustomer.map(pkg => pkg.effective_customer_id).filter(Boolean) || []
          )];

          if (mapping.picklist_id) {
            mappedPicklistId = mapping.picklist_id;
            mappingType = 'picklist';

            // ดึง customer_ids จาก Picklist
            const { data: picklistItems } = await supabase
              .from('picklist_items')
              .select('order_id')
              .eq('picklist_id', mapping.picklist_id);

            const orderIds = [...new Set(picklistItems?.map(item => item.order_id).filter(Boolean) || [])];
            
            if (orderIds.length > 0) {
              const { data: orders } = await supabase
                .from('wms_orders')
                .select('customer_id')
                .in('order_id', orderIds);

              const targetCustomerIds = [...new Set(orders?.map(o => o.customer_id).filter(Boolean) || [])];
              const matchedCustomerIds = bfsCustomerIds.filter(id => targetCustomerIds.includes(id));
              
              // ✅ FIX (edit04): ใช้ effective_customer_id แทน customer_id
              matchedPackageIds = bfsPackagesWithCustomer
                ?.filter(pkg => pkg.effective_customer_id && matchedCustomerIds.includes(pkg.effective_customer_id))
                .map(pkg => pkg.id) || [];
            }

            // อัปเดต trip_id จาก picklist
            const { data: selectedPicklist } = await supabase
              .from('picklists')
              .select('trip_id')
              .eq('id', mapping.picklist_id)
              .single();

            if (selectedPicklist?.trip_id) {
              await supabase
                .from('loadlists')
                .update({ trip_id: selectedPicklist.trip_id })
                .eq('id', loadlist.id);
            }

            // Link picklist to loadlist
            await supabase
              .from('wms_loadlist_picklists')
              .insert({ loadlist_id: loadlist.id, picklist_id: mapping.picklist_id });

          } else if (mapping.face_sheet_id) {
            mappedFaceSheetId = mapping.face_sheet_id;
            mappingType = 'face_sheet';

            // ดึง customer_ids จาก Face Sheet
            const { data: fsPackages } = await supabase
              .from('face_sheet_packages')
              .select('customer_id')
              .eq('face_sheet_id', mapping.face_sheet_id);

            const targetCustomerIds = [...new Set(fsPackages?.map(pkg => pkg.customer_id).filter(Boolean) || [])];
            const matchedCustomerIds = bfsCustomerIds.filter(id => targetCustomerIds.includes(id));
            
            // ✅ FIX (edit04): ใช้ effective_customer_id แทน customer_id
            matchedPackageIds = bfsPackagesWithCustomer
              ?.filter(pkg => pkg.effective_customer_id && matchedCustomerIds.includes(pkg.effective_customer_id))
              .map(pkg => pkg.id) || [];

            // Link face sheet to loadlist
            await supabase
              .from('loadlist_face_sheets')
              .insert({ loadlist_id: loadlist.id, face_sheet_id: mapping.face_sheet_id });
          }

          // ตรวจสอบว่ามี packages ที่ match หรือไม่
          if (mappingType && matchedPackageIds.length === 0) {
            // Cleanup และ return error
            await supabase.from('loadlists').delete().eq('id', loadlist.id);
            return NextResponse.json(
              { 
                error: 'ไม่พบรหัสลูกค้าที่ตรงกัน ไม่สามารถสร้างใบโหลดได้',
                details: `BFS ${bonus_face_sheet_id} ไม่มี customer_id ที่ตรงกับ ${mappingType === 'picklist' ? 'Picklist' : 'Face Sheet'} ที่เลือก`
              },
              { status: 400 }
            );
          }
        }

        // Insert BFS link พร้อม mapping data
        const { error: linkError } = await supabase
          .from('wms_loadlist_bonus_face_sheets')
          .insert({
            loadlist_id: loadlist.id,
            bonus_face_sheet_id: bonus_face_sheet_id,
            mapped_picklist_id: mappedPicklistId,
            mapped_face_sheet_id: mappedFaceSheetId,
            matched_package_ids: matchedPackageIds.length > 0 ? matchedPackageIds : null,
            mapping_type: mappingType
          });

        if (linkError) {
          await supabase.from('loadlists').delete().eq('id', loadlist.id);
          return NextResponse.json(
            { error: 'Failed to link bonus face sheet to loadlist', details: linkError.message },
            { status: 500 }
          );
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

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);

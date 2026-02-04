import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Build query
    let query = supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        created_at,
        updated_at,
        vehicle_id,
        driver_employee_id,
        trip_id,
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
        ),
        loadlist_face_sheets (
          face_sheet_id,
          face_sheets:face_sheet_id (
            id,
            face_sheet_no,
            status,
            face_sheet_items (
              id
            )
          )
        ),
        wms_loadlist_bonus_face_sheets (
          bonus_face_sheet_id,
          bonus_face_sheets:bonus_face_sheet_id (
            id,
            face_sheet_no,
            status,
            bonus_face_sheet_items (
              id
            )
          )
        )
      `);

    // Apply status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Execute query
    const { data: allLoadlists, error } = await query.order('loadlist_code', { ascending: false });

    // ✅ กฎการแสดง Loadlist:
    // 1. LD ที่มี Picklist หรือ Face Sheet → แสดงเสมอ (แต่ต้องยังไม่ถูกโหลดโดย LD อื่น)
    // 2. LD ที่มีเฉพาะ BFS → แสดงเฉพาะถ้า BFS นั้นไม่ได้แมพกับ LD อื่นที่มี picklist/face sheet
    //    (ถ้า BFS แมพกับ LD ที่มี picklist/face sheet แล้ว จะโหลดพร้อมกัน ไม่ต้องแสดง LD BFS แยก)
    // 3. LD ว่าง (ไม่มี document) → ไม่แสดง
    // 4. ✅ NEW: LD ที่มี Picklist/Face Sheet ซึ่งถูกโหลดไปแล้วโดย LD อื่น → ซ่อน

    // ✅ FIX: Query แยกเพื่อหา Picklist/Face Sheet ที่ถูกโหลดไปแล้ว
    // เพราะ query หลักมี status filter ทำให้ไม่เห็น loaded loadlists
    const loadedPicklistIds = new Set<number>();
    const loadedFaceSheetIds = new Set<number>();

    // Query picklist mappings ที่ถูกโหลดแล้ว (loaded_at != null)
    const { data: loadedPicklistMappings } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .not('loaded_at', 'is', null);

    loadedPicklistMappings?.forEach((pl: any) => {
      if (pl.picklist_id) {
        loadedPicklistIds.add(pl.picklist_id);
      }
    });

    // Query face sheet mappings ที่ถูกโหลดแล้ว (loaded_at != null)
    const { data: loadedFaceSheetMappings } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id')
      .not('loaded_at', 'is', null);

    loadedFaceSheetMappings?.forEach((fs: any) => {
      if (fs.face_sheet_id) {
        loadedFaceSheetIds.add(fs.face_sheet_id);
      }
    });

    // ✅ NEW: Query for loadlists with online orders
    const { data: onlineOrderLoadlists } = await supabase
      .from('packing_backup_orders')
      .select('loadlist_id')
      .not('loadlist_id', 'is', null)
      .order('loadlist_id');

    const loadlistIdsWithOnlineOrders = new Set(
      onlineOrderLoadlists?.map((o: any) => o.loadlist_id) || []
    );
    console.log(`📦 Found ${loadlistIdsWithOnlineOrders.size} loadlists with online orders`);

    // หา BFS IDs ที่แมพกับ loadlist ที่มี picklist/face sheet
    const bfsIdsWithMainLoadlist = new Set<number>();
    allLoadlists?.forEach((loadlist: any) => {
      const hasPicklist = (loadlist.wms_loadlist_picklists || []).length > 0;
      const hasFaceSheet = (loadlist.loadlist_face_sheets || []).length > 0;

      if (hasPicklist || hasFaceSheet) {
        // LD นี้มี picklist/face sheet - เก็บ BFS IDs ที่แมพกับ LD นี้
        (loadlist.wms_loadlist_bonus_face_sheets || []).forEach((bfs: any) => {
          if (bfs.bonus_face_sheet_id) {
            bfsIdsWithMainLoadlist.add(bfs.bonus_face_sheet_id);
          }
        });
      }
    });

    // Filter loadlists
    const loadlists = allLoadlists?.filter((loadlist: any) => {
      const picklistLinks = loadlist.wms_loadlist_picklists || [];
      const faceSheetLinks = loadlist.loadlist_face_sheets || [];
      const bfsList = loadlist.wms_loadlist_bonus_face_sheets || [];

      const hasPicklist = picklistLinks.length > 0;
      const hasFaceSheet = faceSheetLinks.length > 0;
      const hasOnlineOrders = loadlistIdsWithOnlineOrders.has(loadlist.id);
      const hasBFS = bfsList.length > 0;

      // ✅ NEW: ตรวจสอบว่า Picklist ทั้งหมดใน LD นี้ ถูกโหลดไปแล้วโดย LD อื่นหรือไม่
      if (hasPicklist) {
        const allPicklistsLoaded = picklistLinks.every((pl: any) =>
          loadedPicklistIds.has(pl.picklist_id)
        );

        if (allPicklistsLoaded) {
          // Picklist ทั้งหมดถูกโหลดไปแล้ว
          // ❌ ยกเลิกการซ่อน: เพื่อให้ User เห็นและกด Complete ได้ (ระบบจะ Auto-Complete ให้)
          // return false; 
        }
      }

      // ✅ NEW: ตรวจสอบว่า Face Sheet ทั้งหมดใน LD นี้ ถูกโหลดไปแล้วโดย LD อื่นหรือไม่
      if (hasFaceSheet) {
        const allFaceSheetsLoaded = faceSheetLinks.every((fs: any) =>
          loadedFaceSheetIds.has(fs.face_sheet_id)
        );

        if (allFaceSheetsLoaded && !hasPicklist) {
          // Face Sheet ทั้งหมดถูกโหลดไปแล้ว
          // ❌ ยกเลิกการซ่อน: เพื่อให้ User เห็นและกด Complete ได้
          // return false;
        }
      }

      // ถ้ามี picklist หรือ face sheet หรือ online orders → แสดง
      if (hasPicklist || hasFaceSheet || hasOnlineOrders) {
        return true;
      }

      // ถ้ามีเฉพาะ BFS → ตรวจสอบว่า BFS นั้นแมพกับ LD อื่นที่มี picklist/face sheet หรือไม่
      if (hasBFS && !hasPicklist && !hasFaceSheet && !hasOnlineOrders) {
        // ตรวจสอบว่า BFS ทั้งหมดใน LD นี้ แมพกับ LD อื่นที่มี picklist/face sheet หรือไม่
        const allBfsHaveMainLoadlist = bfsList.every((bfs: any) =>
          bfsIdsWithMainLoadlist.has(bfs.bonus_face_sheet_id)
        );

        // ถ้า BFS ทั้งหมดแมพกับ LD อื่นแล้ว → ซ่อน LD นี้
        // ถ้ามี BFS บางตัวที่ยังไม่แมพกับ LD อื่น → แสดง LD นี้
        return !allBfsHaveMainLoadlist;
      }

      // LD ว่าง (ไม่มี document) → ไม่แสดง
      return false;
    }) || [];

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
    const tripIds = [...new Set(loadlists?.map((l: any) => l.trip_id).filter(Boolean))];

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

    // Fetch trips to get daily_trip_number (เลขคัน)
    let tripMap: Record<number, any> = {};
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, daily_trip_number')
        .in('trip_id', tripIds);

      trips?.forEach((t: any) => {
        tripMap[t.trip_id] = t;
      });
    }

    // Transform data with summary calculations
    const transformedData = await Promise.all(loadlists?.map(async (loadlist: any) => {
      const picklists = loadlist.wms_loadlist_picklists || [];
      const faceSheets = loadlist.loadlist_face_sheets || [];
      const bonusFaceSheets = loadlist.wms_loadlist_bonus_face_sheets || [];

      // Get picklist IDs, face sheet IDs, and bonus face sheet IDs
      const picklistIds = picklists.map((p: any) => p.picklist_id).filter(Boolean);
      const faceSheetIds = faceSheets.map((fs: any) => fs.face_sheet_id).filter(Boolean);
      const bonusFaceSheetIds = bonusFaceSheets.map((bfs: any) => bfs.bonus_face_sheet_id).filter(Boolean);

      let totalItems = 0;
      let totalPieces = 0;
      let totalPacks = 0;
      let totalWeight = 0;

      // Calculate from picklists
      if (picklistIds.length > 0) {
        const { data: picklistItems } = await supabase
          .from('picklist_items')
          .select(`
            quantity_picked,
            sku_id,
            master_sku!inner (
              qty_per_pack,
              weight_per_piece_kg
            )
          `)
          .in('picklist_id', picklistIds);

        picklistItems?.forEach((item: any) => {
          const qty = parseFloat(item.quantity_picked) || 0;
          const qtyPerPack = item.master_sku?.qty_per_pack || 1;
          const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;

          totalItems += 1;
          totalPieces += qty;
          totalPacks += Math.ceil(qty / qtyPerPack);
          totalWeight += qty * weightPerPiece;
        });
      }

      // Calculate from face sheets
      // ✅ FIX: นับ face_sheet_items เสมอ ไม่ว่าจะมี BFS หรือไม่
      // เพราะ Face Sheet และ BFS เป็นคนละ document - ต้องนับทั้งสองอย่าง
      const hasBonusFaceSheets = bonusFaceSheetIds.length > 0;
      if (faceSheetIds.length > 0) {
        const { data: faceSheetItems } = await supabase
          .from('face_sheet_items')
          .select(`
            quantity_picked,
            sku_id,
            master_sku!inner (
              qty_per_pack,
              weight_per_piece_kg
            )
          `)
          .in('face_sheet_id', faceSheetIds);

        faceSheetItems?.forEach((item: any) => {
          const qty = parseFloat(item.quantity_picked) || 0;
          const qtyPerPack = item.master_sku?.qty_per_pack || 1;
          const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;

          totalItems += 1;
          totalPieces += qty;
          totalPacks += Math.ceil(qty / qtyPerPack);
          totalWeight += qty * weightPerPiece;
        });
      }

      // Calculate from bonus face sheets
      // ✅ FIX: กรองเฉพาะ items ที่อยู่ใน matched_package_ids (แมพกับ loadlist นี้)
      if (bonusFaceSheetIds.length > 0) {
        // Get matched_package_ids from wms_loadlist_bonus_face_sheets
        const matchedPackageIds = new Set<number>(
          bonusFaceSheets.flatMap((bfs: any) => {
            // ต้อง query matched_package_ids จาก wms_loadlist_bonus_face_sheets
            return [];
          })
        );

        // Query matched_package_ids separately
        const { data: bfsLinks } = await supabase
          .from('wms_loadlist_bonus_face_sheets')
          .select('matched_package_ids')
          .eq('loadlist_id', loadlist.id);

        const allMatchedPackageIds = new Set<number>(
          bfsLinks?.flatMap((link: any) => link.matched_package_ids || []) || []
        );

        // Fetch bonus face sheet items with package_id
        const { data: bonusFaceSheetItems } = await supabase
          .from('bonus_face_sheet_items')
          .select('quantity_picked, sku_id, package_id')
          .in('face_sheet_id', bonusFaceSheetIds);

        if (bonusFaceSheetItems && bonusFaceSheetItems.length > 0) {
          // Filter items by matched_package_ids (if any)
          const filteredItems = allMatchedPackageIds.size > 0
            ? bonusFaceSheetItems.filter((item: any) =>
              item.package_id && allMatchedPackageIds.has(item.package_id)
            )
            : bonusFaceSheetItems;

          // Get unique SKU IDs
          const skuIds = [...new Set(filteredItems.map((item: any) => item.sku_id))];

          // Fetch SKU data
          const { data: skuData } = await supabase
            .from('master_sku')
            .select('sku_id, qty_per_pack, weight_per_piece_kg')
            .in('sku_id', skuIds);

          // Create SKU map
          const skuMap: Record<string, any> = {};
          skuData?.forEach((sku: any) => {
            skuMap[sku.sku_id] = sku;
          });

          // Calculate totals
          filteredItems.forEach((item: any) => {
            const qty = parseFloat(item.quantity_picked) || 0;
            const sku = skuMap[item.sku_id];
            const qtyPerPack = sku?.qty_per_pack || 1;
            const weightPerPiece = parseFloat(sku?.weight_per_piece_kg) || 0;

            totalItems += 1;
            totalPieces += qty;
            totalPacks += Math.ceil(qty / qtyPerPack);
            totalWeight += qty * weightPerPiece;
          });
        }
      }

      // ✅ NEW: Calculate from online orders
      if (loadlistIdsWithOnlineOrders.has(loadlist.id)) {
        const { data: onlineOrders } = await supabase
          .from('packing_backup_orders')
          .select('id')
          .eq('loadlist_id', loadlist.id);

        if (onlineOrders && onlineOrders.length > 0) {
          // Online orders count as 1 item per order
          totalItems += onlineOrders.length;
          totalPieces += onlineOrders.length;
          totalPacks += onlineOrders.length;
          // Estimate weight 0.5 kg per online order (since we don't have actual SKU data)
          totalWeight += onlineOrders.length * 0.5;
        }
      }

      // Determine which document types are present
      const documentTypes: string[] = [];
      if (picklists.length > 0) documentTypes.push('ใบหยิบ');
      if (faceSheets.length > 0) documentTypes.push('ใบปะหน้า');
      if (bonusFaceSheets.length > 0) documentTypes.push('ของแถม');
      if (loadlistIdsWithOnlineOrders.has(loadlist.id)) documentTypes.push('ออนไลน์');

      // Get daily_trip_number (เลขคัน) from trip
      const trip = loadlist.trip_id ? tripMap[loadlist.trip_id] : null;

      return {
        loadlist_id: loadlist.id,
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_items: totalItems,
        total_pieces: totalPieces,
        total_packs: totalPacks,
        total_weight: Math.round(totalWeight * 100) / 100, // Round to 2 decimals
        created_at: loadlist.created_at,
        updated_at: loadlist.updated_at,
        vehicle: loadlist.vehicle_id ? vehicleMap[loadlist.vehicle_id] : null,
        driver: loadlist.driver_employee_id ? driverMap[loadlist.driver_employee_id] : null,
        document_types: documentTypes,
        daily_trip_number: trip?.daily_trip_number || null
      };
    }) || []);

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export with auth wrapper
export const GET = withAuth(handleGet);

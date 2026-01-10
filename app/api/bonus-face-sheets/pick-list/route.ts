import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bonus-face-sheets/pick-list?id=xxx&loadlist_id=xxx
 * Get data for printing pick list form (ใบหยิบสินค้า)
 * Groups packages by trip_number and determines destination (PQTD/MRTD)
 * 
 * ✅ FIX (edit08): ใช้ matched_package_ids จาก wms_loadlist_bonus_face_sheets
 * เพื่อแสดงเฉพาะ packages ที่ถูกแมพตอนสร้าง loadlist
 * 
 * ✅ FIX (edit09): รองรับ loadlist ที่มีหลาย BFS - รวม packages จากทุก BFS
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id'); // bonus_face_sheet_id (optional if loadlist_id provided)
    const loadlistId = searchParams.get('loadlist_id');

    // ✅ FIX (edit09): ถ้ามี loadlist_id ให้ดึงทุก BFS ใน loadlist
    let matchedPackageIds: number[] = [];
    let mappingInfos: Array<{ bfs_id: number; bfs_no: string; mapping_type: string | null; mapped_doc_code: string | null; matched_count: number }> = [];
    let loadlistCode: string | null = null;
    let allBfsIds: number[] = [];

    if (loadlistId) {
      const loadlistIdNum = parseInt(loadlistId);
      if (!isNaN(loadlistIdNum)) {
        // ดึง loadlist_code
        const { data: loadlist } = await supabase
          .from('loadlists')
          .select('loadlist_code')
          .eq('id', loadlistIdNum)
          .single();
        loadlistCode = loadlist?.loadlist_code || null;

        // ✅ FIX (edit09): ดึง mapping info จากทุก BFS ใน loadlist
        const { data: allMappings } = await supabase
          .from('wms_loadlist_bonus_face_sheets')
          .select('bonus_face_sheet_id, matched_package_ids, mapping_type, mapped_picklist_id, mapped_face_sheet_id')
          .eq('loadlist_id', loadlistIdNum);

        if (allMappings && allMappings.length > 0) {
          // รวม matched_package_ids จากทุก BFS
          for (const mapping of allMappings) {
            const pkgIds = mapping.matched_package_ids || [];
            matchedPackageIds.push(...pkgIds);
            allBfsIds.push(mapping.bonus_face_sheet_id);

            // ดึงเลข BFS
            const { data: bfs } = await supabase
              .from('bonus_face_sheets')
              .select('face_sheet_no')
              .eq('id', mapping.bonus_face_sheet_id)
              .single();

            // ดึงเลขเอกสารที่แมพ
            let mappedDocCode: string | null = null;
            if (mapping.mapping_type === 'picklist' && mapping.mapped_picklist_id) {
              const { data: picklist } = await supabase
                .from('picklists')
                .select('picklist_code')
                .eq('id', mapping.mapped_picklist_id)
                .single();
              mappedDocCode = picklist?.picklist_code || null;
            } else if (mapping.mapping_type === 'face_sheet' && mapping.mapped_face_sheet_id) {
              const { data: fs } = await supabase
                .from('face_sheets')
                .select('face_sheet_no')
                .eq('id', mapping.mapped_face_sheet_id)
                .single();
              mappedDocCode = fs?.face_sheet_no || null;
            }

            mappingInfos.push({
              bfs_id: mapping.bonus_face_sheet_id,
              bfs_no: bfs?.face_sheet_no || `BFS-${mapping.bonus_face_sheet_id}`,
              mapping_type: mapping.mapping_type,
              mapped_doc_code: mappedDocCode,
              matched_count: pkgIds.length
            });
          }

          console.log(`🔍 [pick-list] Found ${allMappings.length} BFS mappings, total matched_package_ids: ${matchedPackageIds.length}`);
        }
      }
    }

    // ถ้าไม่มี loadlist_id หรือไม่พบ mappings ให้ใช้ id เดิม
    if (matchedPackageIds.length === 0 && id) {
      allBfsIds = [parseInt(id)];
    }

    if (allBfsIds.length === 0 && !id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ id หรือ loadlist_id' },
        { status: 400 }
      );
    }

    // ดึงข้อมูล BFS แรกสำหรับแสดงใน header (หรือรวมถ้ามีหลายตัว)
    const primaryBfsId = id ? parseInt(id) : allBfsIds[0];
    const { data: faceSheet, error: fsError } = await supabase
      .from('bonus_face_sheets')
      .select('id, face_sheet_no, total_packages, created_date, status')
      .eq('id', primaryBfsId)
      .single();

    if (fsError || !faceSheet) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // ✅ FIX (edit09): ดึง packages จากทุก BFS ที่อยู่ใน loadlist
    let packages: any[] = [];
    
    if (matchedPackageIds.length > 0) {
      // ดึงเฉพาะ matched packages จากทุก BFS
      const { data: pkgData, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id, 
          face_sheet_id,
          package_number, 
          barcode_id, 
          shop_name, 
          order_no, 
          hub, 
          storage_location,
          trip_number
        `)
        .in('id', matchedPackageIds)
        .order('package_number');

      if (pkgError) {
        console.error('Error fetching packages:', pkgError);
        return NextResponse.json(
          { success: false, error: pkgError.message },
          { status: 500 }
        );
      }
      packages = pkgData || [];
      console.log(`🔍 [pick-list] Fetched ${packages.length} packages from ${matchedPackageIds.length} matched IDs`);
    } else if (allBfsIds.length > 0) {
      // Fallback: ดึงทุก packages จาก BFS ที่ระบุ
      const { data: pkgData, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .select(`
          id, 
          face_sheet_id,
          package_number, 
          barcode_id, 
          shop_name, 
          order_no, 
          hub, 
          storage_location,
          trip_number
        `)
        .in('face_sheet_id', allBfsIds)
        .order('package_number');

      if (pkgError) {
        console.error('Error fetching packages:', pkgError);
        return NextResponse.json(
          { success: false, error: pkgError.message },
          { status: 500 }
        );
      }
      packages = pkgData || [];
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ไม่พบแพ็คในใบปะหน้าของแถมนี้',
        no_mapped_packages: true,
        loadlist_code: loadlistCode,
        bfs_count: allBfsIds.length
      }, { status: 400 });
    }

    // Get daily_trip_number from receiving_route_trips
    const tripNumbers = [...new Set(packages.map(p => p.trip_number).filter(Boolean))];
    
    // Parse trip_number format: {plan_code}-{trip_code}
    const tripCodeMap: Record<string, number | null> = {};
    
    for (const tripNumber of tripNumbers) {
      if (!tripNumber) continue;
      
      // Try to find the trip by trip_code
      const parts = tripNumber.split('-');
      if (parts.length >= 2) {
        const tripCode = parts.slice(1).join('-'); // Everything after first dash
        
        const { data: trip } = await supabase
          .from('receiving_route_trips')
          .select('daily_trip_number')
          .eq('trip_code', tripCode)
          .single();
        
        tripCodeMap[tripNumber] = trip?.daily_trip_number || null;
      }
    }

    // Group packages by trip_number (or 'UNASSIGNED' if no trip_number)
    const tripGroupsMap = new Map<string, {
      trip_number: string;
      daily_trip_number: number | null;
      destination_location: string;
      packages: any[];
    }>();

    for (const pkg of packages) {
      const tripNumber = pkg.trip_number && pkg.trip_number.trim() !== '' ? pkg.trip_number : 'UNASSIGNED';
      
      if (!tripGroupsMap.has(tripNumber)) {
        // Determine destination based on storage_location prefix
        // PQ* -> PQTD, MR* -> MRTD
        const destination = pkg.storage_location?.startsWith('PQ') ? 'PQTD' : 'MRTD';
        
        tripGroupsMap.set(tripNumber, {
          trip_number: tripNumber,
          daily_trip_number: tripCodeMap[tripNumber] || null,
          destination_location: destination,
          packages: []
        });
      }
      
      tripGroupsMap.get(tripNumber)!.packages.push({
        package_id: pkg.id,
        package_number: pkg.package_number,
        barcode_id: pkg.barcode_id,
        shop_name: pkg.shop_name,
        order_no: pkg.order_no,
        hub: pkg.hub,
        storage_location: pkg.storage_location,
        trip_number: pkg.trip_number
      });
    }

    // Convert to array and sort by trip_number
    const tripGroups = Array.from(tripGroupsMap.values())
      .sort((a, b) => {
        // Sort by daily_trip_number if available, otherwise by trip_number
        if (a.daily_trip_number && b.daily_trip_number) {
          return a.daily_trip_number - b.daily_trip_number;
        }
        return a.trip_number.localeCompare(b.trip_number);
      });

    // นับจำนวนร้านค้า (unique shop_name)
    const uniqueShops = new Set(packages.map(p => p.shop_name).filter(Boolean));

    // ✅ FIX (edit09): สร้าง summary ของ BFS ที่รวมอยู่
    const bfsSummary = mappingInfos.length > 0 
      ? mappingInfos.map(m => `${m.bfs_no} → ${m.mapped_doc_code || '-'} (${m.matched_count})`).join(', ')
      : faceSheet.face_sheet_no;

    return NextResponse.json({
      success: true,
      data: {
        face_sheet_no: mappingInfos.length > 1 
          ? `${mappingInfos.length} BFS รวม` 
          : faceSheet.face_sheet_no,
        created_date: faceSheet.created_date,
        total_packages: packages.length,
        total_shops: uniqueShops.size,
        status: faceSheet.status,
        loadlist_code: loadlistCode,
        trip_groups: tripGroups,
        // ✅ FIX (edit09): ข้อมูล mapping จากทุก BFS
        mapping_infos: mappingInfos,
        bfs_summary: bfsSummary,
        matched_package_count: matchedPackageIds.length,
        total_bfs_count: allBfsIds.length
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/pick-list:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

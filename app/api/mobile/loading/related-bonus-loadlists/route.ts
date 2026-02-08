import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/mobile/loading/related-bonus-loadlists
 * ดึง BFS loadlists ที่แมพกับ picklist เดียวกันกับ loadlist ที่กำลังจะโหลด
 * 
 * Query params:
 * - loadlist_id หรือ loadlist_code: loadlist ที่กำลังจะโหลด
 * 
 * Returns:
 * - related_loadlists: รายการ BFS loadlists ที่แมพกับ picklist เดียวกัน
 * - order_nos: เลข MR/PQ จาก packages ที่แมพ
 * - total_packages: จำนวนแพ็คทั้งหมด
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const loadlist_id = searchParams.get('loadlist_id');
    const loadlist_code = searchParams.get('loadlist_code');

    if (!loadlist_id && !loadlist_code) {
      return NextResponse.json(
        { error: 'กรุณาระบุ loadlist_id หรือ loadlist_code' },
        { status: 400 }
      );
    }

    // 1. ดึง loadlist และ picklist_ids ที่เชื่อมโยง
    let loadlistQuery = supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        trip_id,
        wms_loadlist_picklists (
          picklist_id
        )
      `);

    if (loadlist_id) {
      loadlistQuery = loadlistQuery.eq('id', loadlist_id);
    } else {
      loadlistQuery = loadlistQuery.eq('loadlist_code', loadlist_code);
    }

    const { data: loadlist, error: loadlistError } = await loadlistQuery.single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลด', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // ดึง picklist_ids จาก loadlist
    const picklistIds = loadlist.wms_loadlist_picklists?.map((lp: any) => lp.picklist_id) || [];

    // ถ้าไม่มี picklist ให้ดึงจาก trip_id
    if (picklistIds.length === 0 && loadlist.trip_id) {
      const { data: picklists } = await supabase
        .from('picklists')
        .select('id')
        .eq('trip_id', loadlist.trip_id);

      picklists?.forEach((p: any) => picklistIds.push(p.id));
    }

    if (picklistIds.length === 0) {
      return NextResponse.json({
        success: true,
        has_related: false,
        related_loadlists: [],
        message: 'ไม่มี picklist ที่เชื่อมโยง'
      });
    }

    // 2. หา BFS loadlists ที่แมพกับ picklist เหล่านี้ (ยกเว้น loadlist ปัจจุบัน)
    const { data: bfsMappings, error: bfsError } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select(`
        loadlist_id,
        bonus_face_sheet_id,
        mapped_picklist_id,
        mapped_face_sheet_id,
        mapping_type,
        matched_package_ids,
        loadlists:loadlist_id (
          id,
          loadlist_code,
          status
        ),
        bonus_face_sheets:bonus_face_sheet_id (
          id,
          face_sheet_no,
          total_packages
        )
      `)
      .in('mapped_picklist_id', picklistIds)
      .neq('loadlist_id', loadlist.id);

    if (bfsError) {
      console.error('Error fetching BFS mappings:', bfsError);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล BFS loadlists ได้', details: bfsError.message },
        { status: 500 }
      );
    }

    if (!bfsMappings || bfsMappings.length === 0) {
      return NextResponse.json({
        success: true,
        has_related: false,
        related_loadlists: [],
        message: 'ไม่มี BFS loadlist ที่แมพกับ picklist เดียวกัน'
      });
    }

    // ✅ NEW: กรอง BFS ที่แมพกับ Face Sheet ที่มีสถานะ picking ออกไป
    // เก็บรายการ face_sheet_id ที่ต้องกรอง
    const faceSheetIdsToCheck: number[] = [];
    const bfsMappingsFiltered: typeof bfsMappings = [];

    for (const mapping of bfsMappings) {
      // ถ้ามี mapped_face_sheet_id ให้เช็คสถานะ (ไม่ว่า mapping_type จะเป็นค่าอะไร)
      if (mapping.mapped_face_sheet_id) {
        faceSheetIdsToCheck.push(mapping.mapped_face_sheet_id);
      } else {
        // ถ้าไม่ได้แมพกับ Face Sheet (เป็น picklist หรือไม่มี mapping) ให้เก็บไว้
        bfsMappingsFiltered.push(mapping);
      }
    }

    // ดึงสถานะของ Face Sheets ที่ต้องตรวจสอบ
    let pickingFaceSheetIds = new Set<number>();
    if (faceSheetIdsToCheck.length > 0) {
      const { data: faceSheets } = await supabase
        .from('face_sheets')
        .select('id, status')
        .in('id', [...new Set(faceSheetIdsToCheck)]);

      faceSheets?.forEach((fs: any) => {
        if (fs.status === 'picking') {
          pickingFaceSheetIds.add(fs.id);
        }
      });
    }

    // กรอง BFS ที่แมพกับ Face Sheet ที่ picking ออกไป
    for (const mapping of bfsMappings) {
      if (mapping.mapped_face_sheet_id) {
        if (!pickingFaceSheetIds.has(mapping.mapped_face_sheet_id)) {
          // Face Sheet ไม่ใช่ picking ให้เก็บไว้
          bfsMappingsFiltered.push(mapping);
        }
        // ถ้า Face Sheet เป็น picking จะไม่ถูกเพิ่มเข้า bfsMappingsFiltered (ถูกกรองออก)
      }
    }

    // 3. รวบรวม package_ids ทั้งหมดเพื่อดึง order_no
    const allPackageIds: number[] = [];
    bfsMappingsFiltered.forEach((m: any) => {
      if (m.matched_package_ids && Array.isArray(m.matched_package_ids)) {
        allPackageIds.push(...m.matched_package_ids);
      }
    });

    // 4. ดึง order_no จาก packages
    let orderNoMap: Record<number, { order_no: string; shop_name: string }> = {};
    if (allPackageIds.length > 0) {
      const { data: packages } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id, order_id')
        .in('id', [...new Set(allPackageIds)]);

      const orderIds = [...new Set(packages?.map((p: any) => p.order_id).filter(Boolean) || [])];

      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, shop_name')
          .in('order_id', orderIds);

        // สร้าง map: package_id -> order info
        packages?.forEach((pkg: any) => {
          const order = orders?.find((o: any) => o.order_id === pkg.order_id);
          if (order) {
            orderNoMap[pkg.id] = {
              order_no: order.order_no,
              shop_name: order.shop_name
            };
          }
        });
      }
    }

    // 5. จัดกลุ่มตาม loadlist และรวบรวมข้อมูล
    const loadlistMap = new Map<number, {
      loadlist_id: number;
      loadlist_code: string;
      status: string;
      bfs_list: Array<{
        id: number;
        face_sheet_no: string;
        total_packages: number;
      }>;
      order_nos: string[];
      shop_names: string[];
      total_packages: number;
    }>();

    bfsMappingsFiltered.forEach((m: any) => {
      const loadlistData = m.loadlists;
      const bfsData = m.bonus_face_sheets;
      
      if (!loadlistData || !bfsData) return;

      if (!loadlistMap.has(loadlistData.id)) {
        loadlistMap.set(loadlistData.id, {
          loadlist_id: loadlistData.id,
          loadlist_code: loadlistData.loadlist_code,
          status: loadlistData.status,
          bfs_list: [],
          order_nos: [],
          shop_names: [],
          total_packages: 0
        });
      }

      const entry = loadlistMap.get(loadlistData.id)!;
      
      // เพิ่ม BFS (ถ้ายังไม่มี)
      if (!entry.bfs_list.find(b => b.id === bfsData.id)) {
        entry.bfs_list.push({
          id: bfsData.id,
          face_sheet_no: bfsData.face_sheet_no,
          total_packages: bfsData.total_packages
        });
      }

      // เพิ่ม order_no และ shop_name จาก packages
      const packageIds = m.matched_package_ids || [];
      packageIds.forEach((pkgId: number) => {
        const orderInfo = orderNoMap[pkgId];
        if (orderInfo) {
          if (!entry.order_nos.includes(orderInfo.order_no)) {
            entry.order_nos.push(orderInfo.order_no);
          }
          if (!entry.shop_names.includes(orderInfo.shop_name)) {
            entry.shop_names.push(orderInfo.shop_name);
          }
        }
      });

      entry.total_packages += packageIds.length;
    });

    // 6. แปลงเป็น array และกรองเฉพาะ pending
    const relatedLoadlists = Array.from(loadlistMap.values())
      .filter(l => l.status === 'pending')
      .map(l => ({
        ...l,
        order_nos: l.order_nos.sort(),
        shop_names: l.shop_names
      }));

    return NextResponse.json({
      success: true,
      has_related: relatedLoadlists.length > 0,
      related_loadlists: relatedLoadlists,
      total_related: relatedLoadlists.length,
      total_packages: relatedLoadlists.reduce((sum, l) => sum + l.total_packages, 0),
      all_order_nos: [...new Set(relatedLoadlists.flatMap(l => l.order_nos))].sort()
    });

  } catch (error) {
    console.error('Error in related-bonus-loadlists:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด', details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

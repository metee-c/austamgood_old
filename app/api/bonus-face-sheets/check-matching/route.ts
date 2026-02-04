import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/bonus-face-sheets/check-matching
 * ตรวจสอบ customer_id ที่ตรงกันระหว่าง BFS กับ Picklist หรือ Face Sheet
 * 
 * ✅ FIX (edit02): รองรับ available_package_ids เพื่อตรวจสอบเฉพาะ packages ที่ยังไม่ถูกแมพ
 */
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    const { bonus_face_sheet_id, picklist_id, face_sheet_id, available_package_ids } = body;

    // Validate: ต้องมี BFS ID และเลือกอย่างใดอย่างหนึ่ง
    if (!bonus_face_sheet_id) {
      return NextResponse.json(
        { error: 'bonus_face_sheet_id is required' },
        { status: 400 }
      );
    }

    if (!picklist_id && !face_sheet_id) {
      return NextResponse.json(
        { error: 'Either picklist_id or face_sheet_id is required' },
        { status: 400 }
      );
    }

    if (picklist_id && face_sheet_id) {
      return NextResponse.json(
        { error: 'Cannot specify both picklist_id and face_sheet_id' },
        { status: 400 }
      );
    }

    // ✅ FIX: ถ้าไม่ได้ส่ง available_package_ids มา ให้คำนวณเอง
    let effectiveAvailablePackageIds: number[] | null = available_package_ids;
    
    if (!effectiveAvailablePackageIds) {
      // ดึง matched_package_ids ที่ถูกใช้แล้วจากทุก loadlist
      const { data: usedMappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select('matched_package_ids')
        .eq('bonus_face_sheet_id', bonus_face_sheet_id)
        .not('matched_package_ids', 'is', null);

      const usedPackageIds = new Set<number>();
      usedMappings?.forEach(mapping => {
        (mapping.matched_package_ids || []).forEach((id: number) => usedPackageIds.add(id));
      });

      // ดึง packages ทั้งหมดของ BFS ที่ยังไม่ได้โหลด
      const { data: allPackages } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id')
        .eq('face_sheet_id', bonus_face_sheet_id)
        .not('storage_location', 'is', null);

      // กรองเอาเฉพาะที่ยังไม่ถูกใช้
      effectiveAvailablePackageIds = (allPackages || [])
        .map(p => p.id)
        .filter(id => !usedPackageIds.has(id));
    }

    // ดึง packages จาก BFS พร้อม customer_id (เฉพาะ available packages)
    // ✅ FIX (edit04): ดึง customer_id จาก wms_orders ผ่าน order_id เพราะ bonus_face_sheet_packages.customer_id อาจเป็น null
    let bfsPackagesQuery = supabase
      .from('bonus_face_sheet_packages')
      .select('id, customer_id, order_id, shop_name, barcode_id')
      .eq('face_sheet_id', bonus_face_sheet_id)
      .not('storage_location', 'is', null); // เฉพาะที่ยังไม่ได้โหลด

    // ✅ FIX: กรองเฉพาะ available packages
    if (effectiveAvailablePackageIds && effectiveAvailablePackageIds.length > 0) {
      bfsPackagesQuery = bfsPackagesQuery.in('id', effectiveAvailablePackageIds);
    }

    const { data: bfsPackages, error: bfsError } = await bfsPackagesQuery;

    if (bfsError) {
      return NextResponse.json(
        { error: 'Failed to fetch BFS packages', details: bfsError.message },
        { status: 500 }
      );
    }

    if (!bfsPackages || bfsPackages.length === 0) {
      return NextResponse.json({
        success: true,
        matched: false,
        matched_count: 0,
        matched_package_ids: [],
        matched_customer_ids: [],
        message: 'ไม่พบ packages ใน BFS นี้ หรือ packages ทั้งหมดถูกโหลด/แมพแล้ว'
      });
    }

    // ✅ FIX (edit04): ดึง customer_id จาก wms_orders ผ่าน order_id
    // เพราะ bonus_face_sheet_packages.customer_id อาจเป็น null
    const orderIds = [...new Set(bfsPackages.map(pkg => pkg.order_id).filter(Boolean))];
    
    let orderCustomerMap: Record<number, string> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('wms_orders')
        .select('order_id, customer_id')
        .in('order_id', orderIds);
      
      orders?.forEach(o => {
        if (o.customer_id) {
          orderCustomerMap[o.order_id] = o.customer_id;
        }
      });
    }

    // เพิ่ม customer_id จาก orders ให้กับ packages
    const bfsPackagesWithCustomer = bfsPackages.map(pkg => ({
      ...pkg,
      // ใช้ customer_id จาก package ก่อน ถ้าไม่มีให้ใช้จาก order
      effective_customer_id: pkg.customer_id || (pkg.order_id ? orderCustomerMap[pkg.order_id] : null)
    }));

    // ดึง customer_ids จาก BFS (ใช้ effective_customer_id)
    const bfsCustomerIds = [...new Set(
      bfsPackagesWithCustomer
        .map(pkg => pkg.effective_customer_id)
        .filter((id): id is string => id !== null && id !== undefined)
    )];

    console.log('🔍 [check-matching] BFS customer_ids:', bfsCustomerIds);

    let targetCustomerIds: string[] = [];
    let mappingType: 'picklist' | 'face_sheet';

    if (picklist_id) {
      mappingType = 'picklist';
      
      // ดึง customer_ids จาก Picklist (ผ่าน picklist_items -> wms_orders)
      const { data: picklistItems, error: plError } = await supabase
        .from('picklist_items')
        .select('order_id')
        .eq('picklist_id', picklist_id);

      if (plError) {
        return NextResponse.json(
          { error: 'Failed to fetch picklist items', details: plError.message },
          { status: 500 }
        );
      }

      if (picklistItems && picklistItems.length > 0) {
        const orderIds = [...new Set(picklistItems.map(item => item.order_id).filter(Boolean))];
        
        if (orderIds.length > 0) {
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('customer_id')
            .in('order_id', orderIds);

          targetCustomerIds = [...new Set(
            orders?.map(o => o.customer_id).filter((id): id is string => id !== null) || []
          )];
        }
      }
    } else if (face_sheet_id) {
      mappingType = 'face_sheet';
      
      // ดึง customer_ids จาก Face Sheet packages
      const { data: fsPackages, error: fsError } = await supabase
        .from('face_sheet_packages')
        .select('customer_id')
        .eq('face_sheet_id', face_sheet_id);

      if (fsError) {
        return NextResponse.json(
          { error: 'Failed to fetch face sheet packages', details: fsError.message },
          { status: 500 }
        );
      }

      targetCustomerIds = [...new Set(
        fsPackages?.map(pkg => pkg.customer_id).filter((id): id is string => id !== null) || []
      )];
    }

    // หา customer_ids ที่ตรงกัน
    const matchedCustomerIds = bfsCustomerIds.filter(id => targetCustomerIds.includes(id));

    console.log('🔍 [check-matching] Target customer_ids:', targetCustomerIds);
    console.log('🔍 [check-matching] Matched customer_ids:', matchedCustomerIds);

    // หา packages ที่ customer_id ตรงกัน (ใช้ effective_customer_id)
    const matchedPackages = bfsPackagesWithCustomer.filter(
      pkg => pkg.effective_customer_id && matchedCustomerIds.includes(pkg.effective_customer_id)
    );

    const matchedPackageIds = matchedPackages.map(pkg => pkg.id);

    // ✅ FIX (edit11): ดึง checker_employee_id จาก loadlist ที่มี picklist/face_sheet นี้อยู่แล้ว
    let existingCheckerEmployeeId: number | null = null;
    let hasLoadlist = false; // ✅ NEW: ตรวจสอบว่า picklist มี loadlist แล้วหรือยัง
    let existingLoadlistCode: string | null = null; // ✅ NEW: เก็บ loadlist_code ที่มีอยู่
    
    if (picklist_id) {
      // ค้นหา loadlist ที่มี picklist นี้
      const { data: existingLoadlistData } = await supabase
        .from('wms_loadlist_picklists')
        .select('loadlist_id')
        .eq('picklist_id', picklist_id)
        .limit(1)
        .single();
      
      if (existingLoadlistData?.loadlist_id) {
        hasLoadlist = true; // ✅ มี loadlist แล้ว
        
        const { data: loadlist } = await supabase
          .from('loadlists')
          .select('checker_employee_id, loadlist_code')
          .eq('id', existingLoadlistData.loadlist_id)
          .single();
        
        if (loadlist?.checker_employee_id) {
          existingCheckerEmployeeId = loadlist.checker_employee_id;
        }
        if (loadlist?.loadlist_code) {
          existingLoadlistCode = loadlist.loadlist_code;
        }
      }
    } else if (face_sheet_id) {
      // ค้นหา loadlist ที่มี face_sheet นี้
      const { data: existingLoadlistData } = await supabase
        .from('loadlist_face_sheets')
        .select('loadlist_id')
        .eq('face_sheet_id', face_sheet_id)
        .limit(1)
        .single();
      
      if (existingLoadlistData?.loadlist_id) {
        hasLoadlist = true; // ✅ มี loadlist แล้ว
        
        const { data: loadlist } = await supabase
          .from('loadlists')
          .select('checker_employee_id, loadlist_code')
          .eq('id', existingLoadlistData.loadlist_id)
          .single();
        
        if (loadlist?.checker_employee_id) {
          existingCheckerEmployeeId = loadlist.checker_employee_id;
        }
        if (loadlist?.loadlist_code) {
          existingLoadlistCode = loadlist.loadlist_code;
        }
      }
    }

    // ✅ NEW: ถ้า picklist ยังไม่มี loadlist ให้คืน error
    if (picklist_id && !hasLoadlist) {
      // ดึงข้อมูล picklist เพื่อแสดงชื่อ
      const { data: picklistInfo } = await supabase
        .from('picklists')
        .select('picklist_code')
        .eq('id', picklist_id)
        .single();
      
      const picklistCode = picklistInfo?.picklist_code || `ID:${picklist_id}`;
      
      return NextResponse.json({
        success: false,
        matched: false,
        matched_count: 0,
        matched_package_ids: [],
        matched_customer_ids: [],
        has_loadlist: false,
        picklist_code: picklistCode,
        message: `ใบหยิบ ${picklistCode} ยังไม่ได้สร้างใบโหลด กรุณาติดต่อเฟรินให้สร้างใบโหลดของใบหยิบก่อน`
      });
    }

    return NextResponse.json({
      success: true,
      matched: matchedPackageIds.length > 0,
      matched_count: matchedPackageIds.length,
      total_bfs_packages: bfsPackages.length,
      matched_package_ids: matchedPackageIds,
      matched_customer_ids: matchedCustomerIds,
      mapping_type: mappingType!,
      has_loadlist: hasLoadlist, // ✅ NEW: คืนสถานะว่ามี loadlist แล้วหรือยัง
      loadlist_code: existingLoadlistCode, // ✅ NEW: คืน loadlist_code ที่มีอยู่
      checker_employee_id: existingCheckerEmployeeId, // ✅ NEW: คืน checker จาก loadlist ที่มีอยู่แล้ว
      matched_packages: matchedPackages.map(pkg => ({
        id: pkg.id,
        customer_id: pkg.effective_customer_id,
        shop_name: pkg.shop_name,
        barcode_id: pkg.barcode_id
      })),
      message: matchedPackageIds.length > 0
        ? `พบ ${matchedPackageIds.length} packages ที่ตรงกัน จาก ${bfsPackages.length} packages ทั้งหมด`
        : 'ไม่พบรหัสลูกค้าที่ตรงกัน'
    });

  } catch (error) {
    console.error('Error in check-matching API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

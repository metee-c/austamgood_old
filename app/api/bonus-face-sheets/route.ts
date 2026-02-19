import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * GET /api/bonus-face-sheets
 * ดึงรายการใบปะหน้าของแถมทั้งหมด
 */
async function handleGet(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // ✅ PAGINATION: เพิ่ม page parameter
    const status = searchParams.get('status');
    const created_date = searchParams.get('created_date');
    
    // Calculate offset
    let query = supabase
      .from('bonus_face_sheets')
      .select('*')
      .order('created_date', { ascending: false })
      .order('created_at', { ascending: false })
      ;
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (created_date) {
      query = query.eq('created_date', created_date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching bonus face sheets:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // ✅ เพิ่มข้อมูล assigned/unassigned packages สำหรับแต่ละ face sheet
    const faceSheetIds = data?.map(fs => fs.id) || [];
    let packageStats: Record<number, { assigned: number; unassigned: number }> = {};
    
    if (faceSheetIds.length > 0) {
      const { data: packages, error: pkgError } = await supabase
        .from('bonus_face_sheet_packages')
        .select('id, face_sheet_id, storage_location')
        .in('face_sheet_id', faceSheetIds);
      
      if (!pkgError && packages) {
        // Group by face_sheet_id and count assigned/unassigned
        for (const pkg of packages) {
          if (!packageStats[pkg.face_sheet_id]) {
            packageStats[pkg.face_sheet_id] = { assigned: 0, unassigned: 0 };
          }
          if (pkg.storage_location) {
            packageStats[pkg.face_sheet_id].assigned++;
          } else {
            packageStats[pkg.face_sheet_id].unassigned++;
          }
        }
      }
    }
    
    // ✅ FIX (edit26): ดึง matched_package_ids ที่ใช้แล้วจากทุก loadlist
    // และนับ UNIQUE packages เท่านั้น (ไม่นับซ้ำถ้า package เดียวกันอยู่หลาย loadlist)
    const { data: usedMappings } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id, matched_package_ids')
      .not('matched_package_ids', 'is', null);

    // สร้าง Map เก็บ Set ของ unique package_ids ที่ใช้แล้ว
    const usedPackagesSet = new Map<number, Set<number>>();
    usedMappings?.forEach(mapping => {
      const bfsId = mapping.bonus_face_sheet_id;
      const packageIds = mapping.matched_package_ids || [];
      
      if (!usedPackagesSet.has(bfsId)) {
        usedPackagesSet.set(bfsId, new Set());
      }
      
      // เพิ่ม package_ids เข้า Set (จะไม่ซ้ำโดยอัตโนมัติ)
      packageIds.forEach((pkgId: number) => {
        usedPackagesSet.get(bfsId)!.add(pkgId);
      });
    });
    
    // แปลง Set เป็น count
    const usedPackagesCount = new Map<number, number>();
    usedPackagesSet.forEach((pkgSet, bfsId) => {
      usedPackagesCount.set(bfsId, pkgSet.size);
    });
    
    // Merge stats into data
    const enrichedData = data?.map(fs => {
      const usedCount = usedPackagesCount.get(fs.id) || 0;
      const remainingPackages = Math.max(0, fs.total_packages - usedCount);
      
      return {
        ...fs,
        assigned_packages: packageStats[fs.id]?.assigned ?? 0,
        unassigned_packages: packageStats[fs.id]?.unassigned ?? fs.total_packages,
        // ✅ FIX (edit12): เพิ่ม remaining_packages, used_packages, is_fully_mapped
        used_packages: usedCount,
        remaining_packages: remainingPackages,
        is_fully_mapped: remainingPackages <= 0
      };
    }) || [];
    
    // ✅ PAGINATION: Return with pagination metadata
    return NextResponse.json({
      success: true,
      data: enrichedData
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bonus-face-sheets
 * สร้างใบปะหน้าของแถมใหม่จากออเดอร์ที่มี order_type = 'special'
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      warehouse_id = 'WH001',
      created_by = 'System',
      delivery_date,
      packages = []
    } = body;
    
    if (!packages || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลแพ็คสินค้า' },
        { status: 400 }
      );
    }
    
    // ✅ FIX (BUG-002): Use atomic function - single transaction for all operations
    console.log('📦 Creating bonus face sheet with atomic transaction...');
    
    const { data, error } = await supabase.rpc('create_bonus_face_sheet_with_reservation', {
      p_delivery_date: delivery_date,
      p_packages: packages,
      p_warehouse_id: warehouse_id,
      p_created_by: created_by
    });

    if (error) {
      console.error('❌ Error creating bonus face sheet:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create bonus face sheet', details: error.message },
        { status: 500 }
      );
    }

    // The function returns a table, so we need to get the first row
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    console.log('✅ Bonus face sheet creation result:', JSON.stringify(result, null, 2));

    if (!result || !result.success) {
      console.error('❌ Bonus face sheet creation failed:', result);
      return NextResponse.json(
        { 
          success: false, 
          error: result?.message || 'Failed to create bonus face sheet', 
          details: result?.error_details || result 
        },
        { status: 400 }
      );
    }

    console.log(`✅ Bonus face sheet created successfully: ${result.face_sheet_no}`);
    console.log(`✅ Stock reserved: ${result.items_reserved} items`);
    console.log(`✅ Total: ${result.total_packages} packages, ${result.total_items} items, ${result.total_orders} orders`);

    // ตรวจสอบว่ามี SKU ที่สต็อกไม่พอหรือไม่
    const insufficientItems = result.insufficient_stock_items || [];
    const hasInsufficientStock = Array.isArray(insufficientItems) && insufficientItems.length > 0;

    return NextResponse.json({
      success: true,
      face_sheet_no: result.face_sheet_no,
      face_sheet_id: result.face_sheet_id,
      total_packages: result.total_packages,
      total_items: result.total_items,
      total_orders: result.total_orders,
      items_reserved: result.items_reserved,
      message: result.message,
      has_insufficient_stock: hasInsufficientStock,
      insufficient_stock_items: insufficientItems
    });
  } catch (error: any) {
    console.error('Error in POST /api/bonus-face-sheets:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Export with auth wrappers
export const GET = withShadowLog(withAuth(handleGet));
export const POST = withShadowLog(withAuth(handlePost));

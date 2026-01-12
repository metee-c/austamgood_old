import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/bonus-face-sheets/packages
 * ดึงรายการแพ็คทั้งหมดจากใบปะหน้าของแถม (มุมมองระดับแพ็ค)
 */
async function handleGet(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const status = searchParams.get('status');
    const created_date = searchParams.get('created_date');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '500');
    
    // Query packages with face sheet info
    let query = supabase
      .from('bonus_face_sheet_packages')
      .select(`
        id,
        face_sheet_id,
        package_number,
        barcode_id,
        order_id,
        order_no,
        customer_id,
        shop_name,
        address,
        province,
        hub,
        trip_number,
        pack_no,
        storage_location,
        total_items,
        created_at,
        bonus_face_sheets!inner (
          id,
          face_sheet_no,
          status,
          created_date,
          created_at,
          warehouse_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Filter by face sheet status
    if (status && status !== 'all') {
      query = query.eq('bonus_face_sheets.status', status);
    }
    
    // Filter by created date
    if (created_date) {
      query = query.eq('bonus_face_sheets.created_date', created_date);
    }
    
    const { data: packages, error } = await query;
    
    if (error) {
      console.error('Error fetching packages:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Get items for each package
    const packageIds = packages?.map(p => p.id) || [];
    let itemsMap: Record<number, any[]> = {};
    
    if (packageIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('bonus_face_sheet_items')
        .select(`
          id,
          package_id,
          product_code,
          product_name,
          quantity,
          quantity_picked,
          status,
          source_location_id
        `)
        .in('package_id', packageIds);
      
      if (!itemsError && items) {
        for (const item of items) {
          if (!itemsMap[item.package_id]) {
            itemsMap[item.package_id] = [];
          }
          itemsMap[item.package_id].push(item);
        }
      }
    }
    
    // Check loadlist mapping status with loading info
    const faceSheetIds = [...new Set(packages?.map(p => p.face_sheet_id) || [])];
    // Map: package_id -> { is_mapped: boolean, is_loaded: boolean }
    let packageLoadingStatus: Record<number, { is_mapped: boolean; is_loaded: boolean }> = {};
    
    if (faceSheetIds.length > 0) {
      const { data: mappings } = await supabase
        .from('wms_loadlist_bonus_face_sheets')
        .select(`
          bonus_face_sheet_id, 
          matched_package_ids,
          loaded_at,
          loadlists!inner (
            status
          )
        `)
        .in('bonus_face_sheet_id', faceSheetIds)
        .not('matched_package_ids', 'is', null);
      
      if (mappings) {
        for (const m of mappings) {
          const packageIds = m.matched_package_ids || [];
          const loadlist = m.loadlists as any;
          // ถือว่าโหลดแล้วถ้า: มี loaded_at หรือ loadlist status เป็น loaded/completed/dispatched
          const isLoaded = !!m.loaded_at || 
            ['loaded', 'completed', 'dispatched', 'delivered'].includes(loadlist?.status);
          
          for (const pkgId of packageIds) {
            packageLoadingStatus[pkgId] = {
              is_mapped: true,
              is_loaded: isLoaded
            };
          }
        }
      }
    }
    
    // Transform data
    let transformedPackages = packages?.map(pkg => {
      const faceSheet = pkg.bonus_face_sheets as any;
      const items = itemsMap[pkg.id] || [];
      const loadingInfo = packageLoadingStatus[pkg.id];
      const isMapped = loadingInfo?.is_mapped || false;
      const isLoaded = loadingInfo?.is_loaded || false;
      
      // Calculate loading status: โหลดแล้ว / รอโหลด / รอแมพ
      const loadingStatus = isLoaded ? 'loaded' : isMapped ? 'pending_load' : 'pending_map';
      
      // Calculate item status
      const totalItems = items.length;
      const pickedItems = items.filter(i => i.status === 'picked' || i.status === 'completed').length;
      const itemStatus = totalItems === 0 ? 'empty' : 
                         pickedItems === totalItems ? 'completed' :
                         pickedItems > 0 ? 'partial' : 'pending';
      
      return {
        id: pkg.id,
        face_sheet_id: pkg.face_sheet_id,
        face_sheet_no: faceSheet?.face_sheet_no,
        face_sheet_status: faceSheet?.status,
        warehouse_id: faceSheet?.warehouse_id,
        created_date: faceSheet?.created_date,
        created_at: pkg.created_at,
        package_number: pkg.package_number,
        barcode_id: pkg.barcode_id,
        order_no: pkg.order_no,
        customer_id: pkg.customer_id,
        shop_name: pkg.shop_name,
        province: pkg.province,
        hub: pkg.hub,
        trip_number: pkg.trip_number,
        pack_no: pkg.pack_no,
        storage_location: pkg.storage_location,
        total_items: pkg.total_items,
        is_mapped: isMapped,
        is_loaded: isLoaded,
        loading_status: loadingStatus,
        item_status: itemStatus,
        items: items
      };
    }) || [];
    
    // Apply search filter (client-side for flexibility)
    if (search) {
      const term = search.toLowerCase();
      transformedPackages = transformedPackages.filter(pkg => 
        pkg.face_sheet_no?.toLowerCase().includes(term) ||
        pkg.barcode_id?.toLowerCase().includes(term) ||
        pkg.order_no?.toLowerCase().includes(term) ||
        pkg.shop_name?.toLowerCase().includes(term) ||
        pkg.customer_id?.toLowerCase().includes(term)
      );
    }
    
    return NextResponse.json({
      success: true,
      data: transformedPackages,
      total: transformedPackages.length
    });
  } catch (error: any) {
    console.error('Error in GET /api/bonus-face-sheets/packages:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);

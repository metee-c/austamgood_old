import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('🔵 [DISPATCH-INVENTORY] API called!');
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';
    const exportAll = searchParams.get('export') === 'true';
    
    // Pagination parameters (only for non-export mode)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    console.log(`🔵 [DISPATCH-INVENTORY] Warehouse: ${warehouseId}, Export: ${exportAll}, Page: ${page}, Limit: ${limit}`);

    // ดึงข้อมูล inventory ที่ Dispatch location พร้อมข้อมูลใบหยิบและออเดอร์
    let dispatchInventory: any[] = [];
    
    if (exportAll) {
      // For export, fetch ALL data with pagination loop
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('wms_inventory_balances')
          .select(`
            balance_id,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pallet_id_external,
            lot_no,
            production_date,
            expiry_date,
            total_pack_qty,
            total_piece_qty,
            reserved_pack_qty,
            reserved_piece_qty,
            last_move_id,
            last_movement_at,
            created_at,
            updated_at,
            master_location!location_id (location_name),
            master_sku!sku_id (sku_name, weight_per_piece_kg)
          `)
          .eq('location_id', 'Dispatch')
          .eq('warehouse_id', warehouseId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          dispatchInventory.push(...data);
          offset += batchSize;
          if (data.length < batchSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
    } else {
      // For normal display, use pagination
      const { data, error, count } = await supabase
        .from('wms_inventory_balances')
        .select(`
          balance_id,
          warehouse_id,
          location_id,
          sku_id,
          pallet_id,
          pallet_id_external,
          lot_no,
          production_date,
          expiry_date,
          total_pack_qty,
          total_piece_qty,
          reserved_pack_qty,
          reserved_piece_qty,
          last_move_id,
          last_movement_at,
          created_at,
          updated_at,
          master_location!location_id (location_name),
          master_sku!sku_id (sku_name, weight_per_piece_kg)
        `, { count: 'exact' })
        .eq('location_id', 'Dispatch')
        .eq('warehouse_id', warehouseId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      dispatchInventory = data || [];
      
      // Store count for pagination response
      (request as any).totalCount = count || 0;
    }

    // ✅ ไม่ดึง bonus_face_sheet_items แล้ว - BFS ควรแสดงเฉพาะในแท็บ "จัดสินค้าเสร็จ (BFS)" เท่านั้น
    // BFS flow: บ้านหยิบ -> PQ01-PQ10/MR01-MR10 -> MRTD/PQTD -> โหลดขึ้นรถ (ไม่ผ่าน Dispatch)
    const skuIds = dispatchInventory.map(item => item.sku_id);
    console.log(`[DISPATCH-INVENTORY] SKUs at Dispatch:`, skuIds.length);
    
    // ไม่ query BFS items อีกต่อไป
    const filteredBonusFaceSheets: any[] = [];
    const bonusPackagesMap: Record<number, any> = {};
    
    console.log(`[DISPATCH-INVENTORY] BFS items excluded from Dispatch tab (BFS should show in BFS staging tab only)`);

    // ✅ ดึงข้อมูล picklist items ที่มี active reservations ที่ Dispatch (staging_location_id = 'Dispatch')
    // แทนที่จะดึงตาม SKU ที่มี inventory ที่ Dispatch (ซึ่งอาจเป็น SKU จาก picklist อื่นๆ)
    console.log(`[DISPATCH-INVENTORY] Looking for picklists with active reservations at Dispatch`);

    let picklistData: any[] = [];
    let picklistError = null;
    
    // Query picklist items ที่มี active reservations ที่ Dispatch
    const result = await supabase
      .from('picklist_items')
      .select(`
        id,
        picklist_id,
        sku_id,
        quantity_to_pick,
        quantity_picked,
        status,
        picked_at,
        order_id,
        order_no,
        voided_at,
        picklist_item_reservations!inner (
          reservation_id,
          staging_location_id,
          status,
          reserved_piece_qty
        ),
        picklists!picklist_id (
          id,
          picklist_code,
          status,
          picking_completed_at,
          wms_loadlist_picklists (
            loadlist_id,
            loadlists (
              loadlist_code,
              status
            )
          )
        ),
        wms_orders!order_id (
          order_id,
          order_no,
          customer_id,
          shop_name,
          province,
          phone,
          status,
          delivery_date
        )
      `)
      .eq('picklist_item_reservations.staging_location_id', 'Dispatch')
      .eq('picklist_item_reservations.status', 'picked')
      .is('voided_at', null)
      .neq('status', 'voided');
    
    picklistData = result.data || [];
    picklistError = result.error;

    if (picklistError) throw picklistError;

    console.log(`[DISPATCH-INVENTORY] Picklist Items: Found ${picklistData?.length || 0} items with active Dispatch reservations`);
    
    // ✅ กรอง picklist items ที่ loadlist ยังไม่ loaded หรือ voided (ยังอยู่ที่ Dispatch)
    // ถ้า loadlist status = 'loaded' หรือ 'voided' แสดงว่าสินค้าไม่อยู่ที่ Dispatch แล้ว
    const filteredPicklists = (picklistData || []).filter(item => {
      const picklist = Array.isArray(item.picklists) ? item.picklists[0] : item.picklists;
      const loadlistPicklists = picklist?.wms_loadlist_picklists || [];
      
      // ถ้าไม่มี loadlist = ยังอยู่ที่ Dispatch
      if (loadlistPicklists.length === 0) return true;
      
      // ถ้ามี loadlist ที่ status = 'loaded' หรือ 'voided' = ไม่อยู่ที่ Dispatch แล้ว
      const hasLoadedOrVoidedLoadlist = loadlistPicklists.some((lp: any) => {
        const loadlist = Array.isArray(lp.loadlists) ? lp.loadlists[0] : lp.loadlists;
        return loadlist?.status === 'loaded' || loadlist?.status === 'voided';
      });
      
      // กรองออกถ้ามี loadlist ที่ loaded หรือ voided
      return !hasLoadedOrVoidedLoadlist;
    });
    
    console.log(`[DISPATCH-INVENTORY] Picklist Items after loadlist filter: ${filteredPicklists.length} items`);

    // ✅ ดึงข้อมูล face sheet items ที่มี active reservations ที่ Dispatch (staging_location_id = 'Dispatch')
    console.log(`[DISPATCH-INVENTORY] Looking for face sheets with active reservations at Dispatch`);

    let faceSheetData: any[] = [];
    let faceSheetError = null;
    
    // Query face sheet items ที่มี active reservations ที่ Dispatch
    const fsResult = await supabase
      .from('face_sheet_items')
      .select(`
        id,
        face_sheet_id,
        order_id,
        sku_id,
        quantity_to_pick,
        quantity_picked,
        status,
        picked_at,
        voided_at,
        face_sheet_item_reservations!inner (
          reservation_id,
          staging_location_id,
          status,
          reserved_piece_qty
        ),
        face_sheets!face_sheet_id (
          id,
          face_sheet_no,
          status,
          picking_completed_at,
          loadlist_face_sheets (
            loadlist_id,
            loadlist:loadlists (
              loadlist_code,
              delivery_number,
              status
            )
          )
        ),
        wms_orders!order_id (
          order_id,
          order_no,
          customer_id,
          shop_name,
          province,
          phone,
          status,
          delivery_date
        )
      `)
      .eq('face_sheet_item_reservations.staging_location_id', 'Dispatch')
      .eq('face_sheet_item_reservations.status', 'picked')
      .is('voided_at', null)
      .neq('status', 'voided');
    
    faceSheetData = fsResult.data || [];
    faceSheetError = fsResult.error;

    if (faceSheetError) throw faceSheetError;

    console.log(`[DISPATCH-INVENTORY] Face Sheet Items: Found ${faceSheetData?.length || 0} items with active Dispatch reservations`);
    
    // ✅ กรอง face sheet items ที่ loadlist ยังไม่ loaded หรือ voided (ยังอยู่ที่ Dispatch)
    const filteredFaceSheets = (faceSheetData || []).filter(item => {
      const faceSheet = Array.isArray(item.face_sheets) ? item.face_sheets[0] : item.face_sheets;
      const loadlistFaceSheets = faceSheet?.loadlist_face_sheets || [];
      
      // ถ้าไม่มี loadlist = ยังอยู่ที่ Dispatch
      if (loadlistFaceSheets.length === 0) return true;
      
      // ถ้ามี loadlist ที่ status = 'loaded' หรือ 'voided' = ไม่อยู่ที่ Dispatch แล้ว
      const hasLoadedOrVoidedLoadlist = loadlistFaceSheets.some((lfs: any) => {
        const loadlist = Array.isArray(lfs.loadlist) ? lfs.loadlist[0] : lfs.loadlist;
        return loadlist?.status === 'loaded' || loadlist?.status === 'voided';
      });
      
      // กรองออกถ้ามี loadlist ที่ loaded หรือ voided
      return !hasLoadedOrVoidedLoadlist;
    });
    
    console.log(`[DISPATCH-INVENTORY] Face Sheet Items after loadlist filter: ${filteredFaceSheets.length} items`);

    // จับคู่ข้อมูล inventory กับ face sheet และ picklist (ไม่รวม BFS)
    // ตอนนี้ใช้ balance_id จาก reservations แทนการจับคู่ด้วย SKU
    const enrichedData = (dispatchInventory || []).map(balance => {
      // หา picklist items ที่มี reservation ตรงกับ balance_id นี้
      const relatedPicklistItems = filteredPicklists.filter(item => {
        // ตรวจสอบว่า picklist item นี้มี reservation ที่ชี้ไปที่ balance_id นี้หรือไม่
        const reservations = Array.isArray(item.picklist_item_reservations) 
          ? item.picklist_item_reservations 
          : [item.picklist_item_reservations];
        
        // ถ้าไม่มี balance_id ใน reservation table ให้ fallback ไปใช้ SKU matching
        // (เพื่อรองรับกรณีที่ reservation ไม่มี balance_id)
        return item.sku_id === balance.sku_id;
      });

      // หา face sheet items ที่มี reservation ตรงกับ balance_id นี้ (ใบปะหน้า)
      const relatedFaceSheetItems = filteredFaceSheets.filter(item => {
        const reservations = Array.isArray(item.face_sheet_item_reservations) 
          ? item.face_sheet_item_reservations 
          : [item.face_sheet_item_reservations];
        
        // Fallback to SKU matching
        return item.sku_id === balance.sku_id;
      });

      // รวมเอกสาร Picklist และ Face Sheet เท่านั้น (ไม่รวม BFS)
      const allRelatedDocuments = [
        // Picklist documents
        ...relatedPicklistItems.map(item => {
          const picklist = Array.isArray(item.picklists) ? item.picklists[0] : item.picklists;
          const order = Array.isArray(item.wms_orders) ? item.wms_orders[0] : item.wms_orders;
          
          // ดึง loadlist_code จาก wms_loadlist_picklists
          const loadlistPicklists = picklist?.wms_loadlist_picklists || [];
          const firstLoadlistLink = loadlistPicklists[0];
          const loadlist = firstLoadlistLink?.loadlists ? (Array.isArray(firstLoadlistLink.loadlists) ? firstLoadlistLink.loadlists[0] : firstLoadlistLink.loadlists) : null;

          return {
            document_type: 'picklist',
            picklist_id: picklist?.id,
            picklist_code: picklist?.picklist_code,
            picklist_status: picklist?.status,
            order_id: order?.order_id || item.order_id,
            order_no: order?.order_no || item.order_no,
            shop_name: order?.shop_name,
            province: order?.province,
            phone: order?.phone,
            delivery_date: order?.delivery_date,
            quantity_picked: item.quantity_picked,
            picked_at: item.picked_at,
            // ✅ เพิ่ม loadlist_code
            loadlist_id: firstLoadlistLink?.loadlist_id,
            loadlist_code: loadlist?.loadlist_code,
            loadlist_status: loadlist?.status
          };
        }),
        // Face sheet documents (ใบปะหน้า)
        ...relatedFaceSheetItems.map(item => {
          const faceSheet = Array.isArray(item.face_sheets) ? item.face_sheets[0] : item.face_sheets;
          const order = Array.isArray(item.wms_orders) ? item.wms_orders[0] : item.wms_orders;
          
          // ดึง loadlist_code จาก loadlist_face_sheets
          const loadlistFaceSheets = faceSheet?.loadlist_face_sheets || [];
          const firstLoadlistLink = loadlistFaceSheets[0];
          const loadlist = firstLoadlistLink?.loadlist ? (Array.isArray(firstLoadlistLink.loadlist) ? firstLoadlistLink.loadlist[0] : firstLoadlistLink.loadlist) : null;

          return {
            document_type: 'face_sheet',
            face_sheet_id: faceSheet?.id,
            face_sheet_no: faceSheet?.face_sheet_no,
            face_sheet_code: faceSheet?.face_sheet_no, // alias for display
            face_sheet_status: faceSheet?.status,
            order_id: order?.order_id || item.order_id,
            order_no: order?.order_no,
            shop_name: order?.shop_name,
            province: order?.province,
            phone: order?.phone,
            delivery_date: order?.delivery_date,
            quantity_picked: item.quantity_picked,
            picked_at: item.picked_at,
            // ✅ เพิ่ม loadlist_code
            loadlist_id: firstLoadlistLink?.loadlist_id,
            loadlist_code: loadlist?.loadlist_code,
            loadlist_status: loadlist?.status
          };
        })
      ];

      return {
        ...balance,
        document_type: allRelatedDocuments.length > 0 ? 'mixed' : null,
        related_documents: allRelatedDocuments
      };
    });

    const totalRelatedDocs = enrichedData.reduce((sum, item) => sum + (item.related_documents?.length || 0), 0);
    console.log(`[DISPATCH-INVENTORY] Final enriched data: ${enrichedData.length} items, Total related docs: ${totalRelatedDocs}`);

    // ✅ กรองออก: items ที่ไม่มี related_documents และ total_piece_qty = 0
    // สำหรับ Dispatch tab: ต้องมี related_documents (สินค้ารอโหลด) หรือมี stock จริงๆ
    // ถ้าไม่มีทั้งสองอย่าง = ไม่ควรแสดง
    const finalData = enrichedData.filter(item => {
      // ต้องมี related_documents อย่างน้อย 1 รายการ (สินค้ารอโหลด)
      const hasRelatedDocs = item.related_documents && item.related_documents.length > 0;
      // หรือต้องมี total_piece_qty > 0 (มีสินค้าจริงๆ ที่ Dispatch)
      const hasStock = Number(item.total_piece_qty) > 0;
      
      // ✅ แสดงเฉพาะถ้ามี related_documents หรือมี stock
      // ถ้าไม่มีทั้งสองอย่าง = กรองออก
      const shouldShow = hasRelatedDocs || hasStock;
      
      console.log(`[DISPATCH-INVENTORY] Filter check: SKU=${item.sku_id}, hasRelatedDocs=${hasRelatedDocs}, hasStock=${hasStock}, shouldShow=${shouldShow}`);
      
      return shouldShow;
    });

    console.log(`[DISPATCH-INVENTORY] After filtering (no docs & zero qty): ${finalData.length} items`);

    // Debug: แสดงตัวอย่าง item ที่มี related_documents
    const itemWithDocs = finalData.find(item => item.related_documents && item.related_documents.length > 0);
    if (itemWithDocs) {
      console.log(`[DISPATCH-INVENTORY] ✅ Sample item WITH docs:`, {
        sku_id: itemWithDocs.sku_id,
        related_docs_count: itemWithDocs.related_documents?.length,
        first_doc: itemWithDocs.related_documents?.[0]
      });
    } else {
      console.log(`[DISPATCH-INVENTORY] ⚠️ NO items have related_documents!`);
    }

    const response: any = {
      success: true,
      data: finalData
    };

    // Add pagination info for non-export mode
    if (!exportAll) {
      response.pagination = {
        page,
        limit,
        total: (request as any).totalCount || 0,
        totalPages: Math.ceil(((request as any).totalCount || 0) / limit)
      };
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching dispatch inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

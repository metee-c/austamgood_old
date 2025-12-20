import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('🔵 [DISPATCH-INVENTORY] API called!');
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';
    console.log(`🔵 [DISPATCH-INVENTORY] Warehouse: ${warehouseId}`);

    // ดึงข้อมูล inventory ที่ Dispatch location พร้อมข้อมูลใบหยิบและออเดอร์
    const { data: dispatchInventory, error } = await supabase
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
        master_location!location_id (
          location_name
        ),
        master_sku!sku_id (
          sku_name,
          weight_per_piece_kg
        )
      `)
      .eq('location_id', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // ✅ ดึงข้อมูล bonus face sheet items ที่มี SKU ตรงกับ inventory ที่ Dispatch
    // Query จาก bonus_face_sheet_items โดยไม่กรอง status เพื่อดูทุก item ที่เคยถูก pick
    const skuIds = (dispatchInventory || []).map(item => item.sku_id);
    console.log(`[DISPATCH-INVENTORY] Looking for bonus face sheets with SKUs:`, skuIds);

    const { data: bonusFaceSheetData, error: bfsError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        face_sheet_id,
        package_id,
        sku_id,
        quantity_to_pick,
        quantity_picked,
        status,
        picked_at,
        voided_at,
        bonus_face_sheets!face_sheet_id (
          id,
          face_sheet_no,
          status,
          picking_completed_at,
          wms_loadlist_bonus_face_sheets (
            loadlist_id,
            loadlists (
              loadlist_code,
              status
            )
          )
        ),
        bonus_face_sheet_packages!package_id (
          id,
          package_number,
          barcode_id,
          order_id,
          order_no,
          shop_name,
          province,
          phone,
          hub,
          delivery_type,
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
        )
      `)
      .in('sku_id', skuIds)
      .gt('quantity_picked', 0) // ✅ กรองเฉพาะที่หยิบแล้ว (quantity_picked > 0)
      .is('voided_at', null) // ✅ กรอง voided items ออก
      .neq('status', 'voided'); // ✅ กรอง voided status ออก

    if (bfsError) throw bfsError;

    console.log(`[DISPATCH-INVENTORY] Bonus Face Sheet Items: Found ${bonusFaceSheetData?.length || 0} items (all statuses)`);
    
    // ✅ กรอง bonus face sheet items ที่ loadlist ยังไม่ loaded หรือ voided (ยังอยู่ที่ Dispatch)
    const filteredBonusFaceSheets = (bonusFaceSheetData || []).filter(item => {
      const faceSheet = Array.isArray(item.bonus_face_sheets) ? item.bonus_face_sheets[0] : item.bonus_face_sheets;
      const loadlistBonusFaceSheets = faceSheet?.wms_loadlist_bonus_face_sheets || [];
      
      // ถ้าไม่มี loadlist = ยังอยู่ที่ Dispatch
      if (loadlistBonusFaceSheets.length === 0) return true;
      
      // ถ้ามี loadlist ที่ status = 'loaded' หรือ 'voided' = ไม่อยู่ที่ Dispatch แล้ว
      const hasLoadedOrVoidedLoadlist = loadlistBonusFaceSheets.some((lbfs: any) => {
        const loadlist = Array.isArray(lbfs.loadlists) ? lbfs.loadlists[0] : lbfs.loadlists;
        return loadlist?.status === 'loaded' || loadlist?.status === 'voided';
      });
      
      // กรองออกถ้ามี loadlist ที่ loaded หรือ voided
      return !hasLoadedOrVoidedLoadlist;
    });
    
    console.log(`[DISPATCH-INVENTORY] Bonus Face Sheet Items after loadlist filter: ${filteredBonusFaceSheets.length} items`);

    // ✅ ดึงข้อมูล picklist items ที่มี SKU ตรงกับ inventory ที่ Dispatch
    console.log(`[DISPATCH-INVENTORY] Looking for picklists with SKUs:`, skuIds);

    const { data: picklistData, error: picklistError } = await supabase
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
      .in('sku_id', skuIds)
      .gt('quantity_picked', 0) // ✅ กรองเฉพาะที่หยิบแล้ว (quantity_picked > 0)
      .is('voided_at', null) // ✅ กรอง voided items ออก
      .neq('status', 'voided'); // ✅ กรอง voided status ออก

    if (picklistError) throw picklistError;

    console.log(`[DISPATCH-INVENTORY] Picklist Items: Found ${picklistData?.length || 0} items (all statuses)`);
    
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

    // ✅ ดึงข้อมูล face sheet items ที่มี SKU ตรงกับ inventory ที่ Dispatch (ใบปะหน้า)
    console.log(`[DISPATCH-INVENTORY] Looking for face sheets with SKUs:`, skuIds);

    const { data: faceSheetData, error: faceSheetError } = await supabase
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
      .in('sku_id', skuIds)
      .gt('quantity_picked', 0) // ✅ กรองเฉพาะที่หยิบแล้ว (quantity_picked > 0)
      .is('voided_at', null) // ✅ กรอง voided items ออก
      .neq('status', 'voided'); // ✅ กรอง voided status ออก

    if (faceSheetError) throw faceSheetError;

    console.log(`[DISPATCH-INVENTORY] Face Sheet Items: Found ${faceSheetData?.length || 0} items (all statuses)`);
    
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

    // จับคู่ข้อมูล inventory กับ face sheet, bonus face sheet และ picklist
    const enrichedData = (dispatchInventory || []).map(balance => {
      // หา bonus face sheet items ที่ตรงกับ SKU (เฉพาะที่ยังไม่ loaded)
      const relatedBonusItems = filteredBonusFaceSheets.filter(
        item => item.sku_id === balance.sku_id
      );

      // หา picklist items ที่ตรงกับ SKU
      const relatedPicklistItems = filteredPicklists.filter(
        item => item.sku_id === balance.sku_id
      );

      // หา face sheet items ที่ตรงกับ SKU (ใบปะหน้า)
      const relatedFaceSheetItems = filteredFaceSheets.filter(
        item => item.sku_id === balance.sku_id
      );

      // รวมเอกสารทั้งสามประเภท
      const allRelatedDocuments = [
        // Bonus face sheet documents
        ...relatedBonusItems.map(item => {
          const faceSheet = Array.isArray(item.bonus_face_sheets) ? item.bonus_face_sheets[0] : item.bonus_face_sheets;
          const faceSheetPackage = Array.isArray(item.bonus_face_sheet_packages) ? item.bonus_face_sheet_packages[0] : item.bonus_face_sheet_packages;
          const order = faceSheetPackage?.wms_orders ? (Array.isArray(faceSheetPackage.wms_orders) ? faceSheetPackage.wms_orders[0] : faceSheetPackage.wms_orders) : null;

          return {
            document_type: 'bonus_face_sheet',
            face_sheet_id: faceSheet?.id,
            face_sheet_no: faceSheet?.face_sheet_no,
            face_sheet_status: faceSheet?.status,
            package_id: faceSheetPackage?.id,
            package_number: faceSheetPackage?.package_number,
            barcode_id: faceSheetPackage?.barcode_id,
            order_id: order?.order_id || faceSheetPackage?.order_id,
            order_no: order?.order_no || faceSheetPackage?.order_no,
            shop_name: order?.shop_name || faceSheetPackage?.shop_name,
            province: order?.province || faceSheetPackage?.province,
            phone: order?.phone || faceSheetPackage?.phone,
            delivery_date: order?.delivery_date,
            quantity_picked: item.quantity_picked,
            picked_at: item.picked_at
          };
        }),
        // Picklist documents
        ...relatedPicklistItems.map(item => {
          const picklist = Array.isArray(item.picklists) ? item.picklists[0] : item.picklists;
          const order = Array.isArray(item.wms_orders) ? item.wms_orders[0] : item.wms_orders;

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
            picked_at: item.picked_at
          };
        }),
        // Face sheet documents (ใบปะหน้า)
        ...relatedFaceSheetItems.map(item => {
          const faceSheet = Array.isArray(item.face_sheets) ? item.face_sheets[0] : item.face_sheets;
          const order = Array.isArray(item.wms_orders) ? item.wms_orders[0] : item.wms_orders;

          return {
            document_type: 'face_sheet',
            face_sheet_id: faceSheet?.id,
            face_sheet_no: faceSheet?.face_sheet_no,
            face_sheet_status: faceSheet?.status,
            order_id: order?.order_id || item.order_id,
            order_no: order?.order_no,
            shop_name: order?.shop_name,
            province: order?.province,
            phone: order?.phone,
            delivery_date: order?.delivery_date,
            quantity_picked: item.quantity_picked,
            picked_at: item.picked_at
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

    return NextResponse.json({
      success: true,
      data: finalData
    });
  } catch (error: any) {
    console.error('Error fetching dispatch inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

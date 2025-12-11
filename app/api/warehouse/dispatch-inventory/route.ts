import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';

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
      .eq('location_id', 'WH001-02642')
      .eq('warehouse_id', warehouseId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // ดึงข้อมูล bonus face sheet items ที่เกี่ยวข้อง
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
        bonus_face_sheets!face_sheet_id (
          id,
          face_sheet_no,
          status,
          picking_completed_at
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
      .eq('status', 'picked');

    if (bfsError) throw bfsError;

    // ดึงข้อมูล picklist items ที่เกี่ยวข้อง (สำหรับ route_plan orders)
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
        picklists!picklist_id (
          id,
          picklist_code,
          status,
          picking_completed_at
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
      .eq('status', 'picked');

    if (picklistError) throw picklistError;

    // จับคู่ข้อมูล inventory กับ bonus face sheet และ picklist
    const enrichedData = (dispatchInventory || []).map(balance => {
      // หา bonus face sheet items ที่ตรงกับ SKU
      const relatedBonusItems = (bonusFaceSheetData || []).filter(
        item => item.sku_id === balance.sku_id
      );

      // หา picklist items ที่ตรงกับ SKU
      const relatedPicklistItems = (picklistData || []).filter(
        item => item.sku_id === balance.sku_id
      );

      // รวมเอกสารทั้งสองประเภท
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
        })
      ];

      return {
        ...balance,
        document_type: allRelatedDocuments.length > 0 ? 'mixed' : null,
        related_documents: allRelatedDocuments
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedData
    });
  } catch (error: any) {
    console.error('Error fetching dispatch inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

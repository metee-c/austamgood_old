import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/orders/[id]/items
 * ดึงรายการสินค้าของ Order สำหรับใช้ในการรับสินค้าตีกลับ
 * รวมถึงข้อมูลวันผลิต/วันหมดอายุจาก inventory ที่ถูก pick ไปแล้ว
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient();
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    // ดึงข้อมูล Order
    const { data: order, error: orderError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, customer_id, delivery_date')
      .eq('order_id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return NextResponse.json({ error: 'ไม่พบข้อมูล Order' }, { status: 404 });
    }

    // ดึงข้อมูล Order Items แยก
    const { data: orderItems, error: itemsError } = await supabase
      .from('wms_order_items')
      .select('order_item_id, sku_id, sku_name, order_qty, order_weight')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json({ error: 'ไม่สามารถดึงรายการสินค้าได้' }, { status: 500 });
    }

    // ดึงข้อมูล SKU เพิ่มเติมจาก master_sku
    const skuIds = orderItems?.map((item) => item.sku_id).filter(Boolean) || [];
    let skuMap: Record<string, any> = {};

    if (skuIds.length > 0) {
      const { data: skus } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name, barcode, qty_per_pack, weight_per_piece_kg')
        .in('sku_id', skuIds);

      skuMap =
        skus?.reduce(
          (acc, sku) => {
            acc[sku.sku_id] = sku;
            return acc;
          },
          {} as Record<string, any>
        ) || {};
    }

    // ดึงข้อมูลวันผลิต/วันหมดอายุจาก face_sheet_items + face_sheet_item_reservations + wms_inventory_balances
    // หรือจาก picklist_items + picklist_item_reservations + wms_inventory_balances
    let dateInfoMap: Record<string, { production_date: string | null; expiry_date: string | null }> = {};

    // ลองดึงจาก face_sheet_items ก่อน
    const { data: faceSheetItems } = await supabase
      .from('face_sheet_items')
      .select(`
        sku_id,
        face_sheet_item_reservations (
          balance_id,
          wms_inventory_balances:balance_id (
            production_date,
            expiry_date
          )
        )
      `)
      .eq('order_id', orderId)
      .gt('quantity_picked', 0);

    if (faceSheetItems && faceSheetItems.length > 0) {
      faceSheetItems.forEach((item: any) => {
        if (item.face_sheet_item_reservations && item.face_sheet_item_reservations.length > 0) {
          const reservation = item.face_sheet_item_reservations[0];
          const balance = reservation?.wms_inventory_balances;
          if (balance && !dateInfoMap[item.sku_id]) {
            dateInfoMap[item.sku_id] = {
              production_date: balance.production_date,
              expiry_date: balance.expiry_date,
            };
          }
        }
      });
    }

    // ถ้าไม่พบจาก face_sheet_items ลองดึงจาก picklist_items
    if (Object.keys(dateInfoMap).length === 0) {
      const { data: picklistItems } = await supabase
        .from('picklist_items')
        .select(`
          sku_id,
          picklist_item_reservations (
            balance_id,
            wms_inventory_balances:balance_id (
              production_date,
              expiry_date
            )
          )
        `)
        .eq('order_id', orderId)
        .gt('quantity_picked', 0);

      if (picklistItems && picklistItems.length > 0) {
        picklistItems.forEach((item: any) => {
          if (item.picklist_item_reservations && item.picklist_item_reservations.length > 0) {
            const reservation = item.picklist_item_reservations[0];
            const balance = reservation?.wms_inventory_balances;
            if (balance && !dateInfoMap[item.sku_id]) {
              dateInfoMap[item.sku_id] = {
                production_date: balance.production_date,
                expiry_date: balance.expiry_date,
              };
            }
          }
        });
      }
    }

    // ถ้ายังไม่พบ ลองดึงจาก inventory ที่อยู่ใน Dispatch/Delivery location
    if (Object.keys(dateInfoMap).length < skuIds.length) {
      const { data: dispatchInventory } = await supabase
        .from('wms_inventory_balances')
        .select('sku_id, production_date, expiry_date')
        .in('sku_id', skuIds)
        .in('location_id', ['Dispatch', 'Delivery-In-Progress', 'Delivery-Completed'])
        .gt('total_piece_qty', 0);

      if (dispatchInventory && dispatchInventory.length > 0) {
        dispatchInventory.forEach((inv: any) => {
          if (!dateInfoMap[inv.sku_id]) {
            dateInfoMap[inv.sku_id] = {
              production_date: inv.production_date,
              expiry_date: inv.expiry_date,
            };
          }
        });
      }
    }

    // แปลงข้อมูลให้อยู่ในรูปแบบที่ใช้งานง่าย
    const items =
      orderItems?.map((item: any) => {
        const masterSku = skuMap[item.sku_id];
        const dateInfo = dateInfoMap[item.sku_id];
        return {
          order_item_id: item.order_item_id,
          sku_id: item.sku_id,
          sku_name: masterSku?.sku_name || item.sku_name || item.sku_id,
          barcode: masterSku?.barcode || '',
          quantity: parseFloat(item.order_qty) || 0,
          qty_per_pack: masterSku?.qty_per_pack || 1,
          weight_per_piece_kg: masterSku?.weight_per_piece_kg || 0,
          unit_price: 0,
          production_date: dateInfo?.production_date || null,
          expiry_date: dateInfo?.expiry_date || null,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.order_id,
        order_no: order.order_no,
        status: order.status,
        customer_id: order.customer_id,
        delivery_date: order.delivery_date,
        items,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/orders/[id]/items:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

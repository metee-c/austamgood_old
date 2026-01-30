import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/picklists/validate?trip_id=xxx
 * ตรวจสอบว่า Picklist items ตรงกับ Orders ที่นำเข้าหรือไม่
 * 
 * Returns:
 * - is_valid: boolean
 * - missing_orders: orders ที่อยู่ใน stops แต่ไม่มีใน picklist
 * - missing_items: order_items ที่หายไป
 * - quantity_mismatches: items ที่จำนวนไม่ตรง
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get('trip_id');
    const picklistId = searchParams.get('picklist_id');

    if (!tripId && !picklistId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ trip_id หรือ picklist_id' },
        { status: 400 }
      );
    }

    let targetTripId = tripId ? parseInt(tripId) : null;

    // If picklist_id provided, get trip_id from picklist
    if (picklistId && !targetTripId) {
      const { data: picklist } = await supabase
        .from('picklists')
        .select('trip_id')
        .eq('id', picklistId)
        .single();
      
      if (picklist) {
        targetTripId = picklist.trip_id;
      }
    }

    if (!targetTripId) {
      return NextResponse.json(
        { error: 'ไม่พบ trip_id' },
        { status: 400 }
      );
    }

    // 1. Get all stops for this trip
    const { data: stops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, order_id, tags, stop_name')
      .eq('trip_id', targetTripId);

    if (stopsError) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล stops ได้' },
        { status: 500 }
      );
    }

    // 2. Collect all order IDs from stops (including tags.order_ids)
    const stopOrderIds = new Set<number>();
    const stopOrderMap = new Map<number, { stop_id: number; stop_name: string }>();
    
    (stops || []).forEach(stop => {
      if (stop.order_id) {
        stopOrderIds.add(stop.order_id);
        stopOrderMap.set(stop.order_id, { stop_id: stop.stop_id, stop_name: stop.stop_name });
      }
      if (stop.tags?.order_ids) {
        stop.tags.order_ids.forEach((id: number) => {
          stopOrderIds.add(id);
          stopOrderMap.set(id, { stop_id: stop.stop_id, stop_name: stop.stop_name });
        });
      }
    });

    // 3. Get all picklist items for this trip
    const { data: picklists } = await supabase
      .from('picklists')
      .select('id, picklist_code')
      .eq('trip_id', targetTripId);

    const picklistIds = (picklists || []).map(p => p.id);

    const { data: plItems } = await supabase
      .from('picklist_items')
      .select('id, order_id, order_item_id, sku_id, quantity_to_pick')
      .in('picklist_id', picklistIds.length > 0 ? picklistIds : [-1]);

    // 4. Get order IDs in picklist
    const plOrderIds = new Set<number>();
    (plItems || []).forEach(item => {
      if (item.order_id) plOrderIds.add(item.order_id);
    });

    // 5. Find missing orders (in stops but not in picklist)
    const missingOrders: any[] = [];
    for (const orderId of stopOrderIds) {
      if (!plOrderIds.has(orderId)) {
        const stopInfo = stopOrderMap.get(orderId);
        
        // Get order details
        const { data: order } = await supabase
          .from('wms_orders')
          .select('order_no, status')
          .eq('order_id', orderId)
          .single();

        missingOrders.push({
          order_id: orderId,
          order_no: order?.order_no || 'N/A',
          order_status: order?.status || 'N/A',
          stop_id: stopInfo?.stop_id,
          stop_name: stopInfo?.stop_name
        });
      }
    }

    // 6. Check for quantity mismatches
    const quantityMismatches: any[] = [];
    const missingItems: any[] = [];

    for (const orderId of stopOrderIds) {
      if (plOrderIds.has(orderId)) {
        // Get original order items
        const { data: orderItems } = await supabase
          .from('wms_order_items')
          .select('order_item_id, sku_id, order_qty')
          .eq('order_id', orderId);

        // Get split items if any
        const stopId = stopOrderMap.get(orderId)?.stop_id;
        const { data: splitItems } = await supabase
          .from('receiving_route_stop_items')
          .select('order_item_id, sku_id, allocated_quantity')
          .eq('stop_id', stopId || -1)
          .eq('order_id', orderId);

        // Get picklist items for this order
        const plItemsForOrder = (plItems || []).filter(i => i.order_id === orderId);
        const plItemMap = new Map(plItemsForOrder.map(i => [i.order_item_id, i]));

        for (const orderItem of orderItems || []) {
          const plItem = plItemMap.get(orderItem.order_item_id);
          
          // Check if there's a split item
          const splitItem = (splitItems || []).find(s => s.order_item_id === orderItem.order_item_id);
          const expectedQty = splitItem ? splitItem.allocated_quantity : orderItem.order_qty;

          if (!plItem) {
            // Item missing from picklist
            missingItems.push({
              order_id: orderId,
              order_item_id: orderItem.order_item_id,
              sku_id: orderItem.sku_id,
              expected_qty: expectedQty,
              actual_qty: 0
            });
          } else if (Number(plItem.quantity_to_pick) !== Number(expectedQty)) {
            // Quantity mismatch
            quantityMismatches.push({
              order_id: orderId,
              order_item_id: orderItem.order_item_id,
              sku_id: orderItem.sku_id,
              expected_qty: expectedQty,
              actual_qty: plItem.quantity_to_pick,
              difference: Number(expectedQty) - Number(plItem.quantity_to_pick)
            });
          }
        }
      }
    }

    // 7. Calculate summary
    const isValid = missingOrders.length === 0 && 
                    missingItems.length === 0 && 
                    quantityMismatches.length === 0;

    return NextResponse.json({
      trip_id: targetTripId,
      is_valid: isValid,
      summary: {
        total_orders_in_stops: stopOrderIds.size,
        total_orders_in_picklist: plOrderIds.size,
        missing_orders_count: missingOrders.length,
        missing_items_count: missingItems.length,
        quantity_mismatches_count: quantityMismatches.length
      },
      missing_orders: missingOrders,
      missing_items: missingItems,
      quantity_mismatches: quantityMismatches,
      picklists: picklists || []
    });

  } catch (error: any) {
    console.error('Error validating picklist:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/picklists/validate
 * ตรวจสอบและแก้ไข Picklist ที่มี items หายไป
 * 
 * Body: { trip_id: number, auto_fix: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { trip_id, auto_fix = false } = await request.json();

    if (!trip_id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ trip_id' },
        { status: 400 }
      );
    }

    // First, validate
    const validateResponse = await fetch(
      `${request.nextUrl.origin}/api/picklists/validate?trip_id=${trip_id}`,
      { method: 'GET' }
    );
    const validation = await validateResponse.json();

    if (validation.is_valid) {
      return NextResponse.json({
        success: true,
        message: 'Picklist ถูกต้องแล้ว ไม่ต้องแก้ไข',
        validation
      });
    }

    if (!auto_fix) {
      return NextResponse.json({
        success: false,
        message: 'พบปัญหา กรุณาตั้ง auto_fix: true เพื่อแก้ไขอัตโนมัติ',
        validation
      });
    }

    // Auto-fix: Add missing orders to picklist
    const fixResults: any[] = [];

    if (validation.missing_orders && validation.missing_orders.length > 0) {
      // Get existing picklist for this trip
      const { data: existingPicklist } = await supabase
        .from('picklists')
        .select('id, picklist_code')
        .eq('trip_id', trip_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!existingPicklist) {
        return NextResponse.json({
          success: false,
          message: 'ไม่พบ Picklist สำหรับ trip นี้ กรุณาสร้างใหม่',
          validation
        });
      }

      // Get trip info for warehouse_id
      const { data: trip } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, receiving_route_plans!inner(warehouse_id)')
        .eq('trip_id', trip_id)
        .single();

      const warehouseId = (trip?.receiving_route_plans as any)?.warehouse_id || 'WH001';

      for (const missingOrder of validation.missing_orders) {
        // Get order items
        const { data: orderItems } = await supabase
          .from('wms_order_items')
          .select('order_item_id, order_id, sku_id, order_qty')
          .eq('order_id', missingOrder.order_id);

        // Get order details
        const { data: order } = await supabase
          .from('wms_orders')
          .select('order_no')
          .eq('order_id', missingOrder.order_id)
          .single();

        // Get SKU details
        const skuIds = (orderItems || []).map(i => i.sku_id);
        const { data: skus } = await supabase
          .from('master_sku')
          .select('sku_id, sku_name, uom_base, default_location, qty_per_pack')
          .in('sku_id', skuIds);

        const skuMap = new Map((skus || []).map(s => [s.sku_id, s]));

        // Insert missing items
        const itemsToInsert = (orderItems || []).map(item => {
          const sku = skuMap.get(item.sku_id);
          return {
            picklist_id: existingPicklist.id,
            order_item_id: item.order_item_id,
            sku_id: item.sku_id,
            sku_name: sku?.sku_name || item.sku_id,
            uom: sku?.uom_base || 'ชิ้น',
            order_no: order?.order_no || '-',
            order_id: item.order_id,
            stop_id: missingOrder.stop_id,
            quantity_to_pick: item.order_qty,
            quantity_picked: 0,
            source_location_id: sku?.default_location || 'PK001',
            status: 'pending'
          };
        });

        const { data: insertedItems, error: insertError } = await supabase
          .from('picklist_items')
          .insert(itemsToInsert)
          .select();

        if (insertError) {
          fixResults.push({
            order_id: missingOrder.order_id,
            order_no: missingOrder.order_no,
            status: 'error',
            error: insertError.message
          });
        } else {
          fixResults.push({
            order_id: missingOrder.order_id,
            order_no: missingOrder.order_no,
            status: 'fixed',
            items_added: insertedItems?.length || 0
          });
        }
      }

      // Update picklist totals
      const { data: allItems } = await supabase
        .from('picklist_items')
        .select('quantity_to_pick')
        .eq('picklist_id', existingPicklist.id);

      const totalLines = allItems?.length || 0;
      const totalQuantity = allItems?.reduce((sum, i) => sum + Number(i.quantity_to_pick), 0) || 0;

      await supabase
        .from('picklists')
        .update({
          total_lines: totalLines,
          total_quantity: totalQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPicklist.id);
    }

    return NextResponse.json({
      success: true,
      message: `แก้ไขเสร็จสิ้น: เพิ่ม ${fixResults.filter(r => r.status === 'fixed').length} orders`,
      fix_results: fixResults,
      original_validation: validation
    });

  } catch (error: any) {
    console.error('Error fixing picklist:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

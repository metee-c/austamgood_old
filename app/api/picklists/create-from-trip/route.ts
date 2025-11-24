import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { trip_id } = await request.json();

    if (!trip_id) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    // 1. Fetch trip details with plan info
    const { data: trip, error: tripError } = await supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        trip_sequence,
        plan_id,
        vehicle_id,
        driver_id,
        receiving_route_plans!inner (
          plan_id,
          plan_code,
          plan_name,
          plan_date,
          warehouse_id
        )
      `)
      .eq('trip_id', trip_id)
      .single();

    if (tripError || !trip) {
      console.error('Error fetching trip:', tripError);
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // 2. Generate picklist code (PL-YYYYMMDD-XXX)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { data: existingPicklists } = await supabase
      .from('picklists')
      .select('picklist_code')
      .like('picklist_code', `PL-${today}-%`)
      .order('picklist_code', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existingPicklists && existingPicklists.length > 0) {
      const lastCode = existingPicklists[0].picklist_code;
      const lastSequence = parseInt(lastCode.split('-')[2]);
      sequence = lastSequence + 1;
    }

    const picklistCode = `PL-${today}-${sequence.toString().padStart(3, '0')}`;

    // 3. Fetch all stops and orders for this trip
    const { data: stops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select(`
        stop_id,
        sequence_no,
        stop_name,
        order_id,
        tags
      `)
      .eq('trip_id', trip_id)
      .order('sequence_no', { ascending: true });

    if (stopsError) {
      console.error('Error fetching stops:', stopsError);
      return NextResponse.json(
        { error: 'Failed to fetch stops' },
        { status: 500 }
      );
    }

    // 4. Collect all order IDs from stops
    const orderIds = new Set<number>();
    (stops || []).forEach((stop) => {
      if (stop.order_id) orderIds.add(stop.order_id);
      if (stop.tags?.order_ids) {
        stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
      }
    });

    if (orderIds.size === 0) {
      return NextResponse.json(
        { error: 'No orders found in this trip' },
        { status: 400 }
      );
    }

    // 5. Fetch order items for all orders
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('wms_order_items')
      .select(`
        order_item_id,
        order_id,
        sku_id,
        order_qty,
        order_weight
      `)
      .in('order_id', Array.from(orderIds));

    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return NextResponse.json(
        { error: 'Failed to fetch order items' },
        { status: 500 }
      );
    }

    // 6. Fetch SKU details
    const skuIds = [...new Set((orderItems || []).map(item => item.sku_id))];
    const { data: skus, error: skusError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, uom_base, barcode, default_location')
      .in('sku_id', skuIds);

    if (skusError) {
      console.error('Error fetching SKUs:', skusError);
    }

    // 7. Note: We will use default_location from SKU master data as the primary source
    // for source_location_id (preparation area configured in master data)

    // 8. Fetch order details
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no')
      .in('order_id', Array.from(orderIds));

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    }

    // Create maps for quick lookup
    const skuMap = new Map((skus || []).map(sku => [sku.sku_id, sku]));
    const orderMap = new Map((orders || []).map(order => [order.order_id, order]));

    // 9. Create picklist
    const totalQuantity = (orderItems || []).reduce((sum, item) => sum + (item.order_qty || 0), 0);
    const totalLines = (orderItems || []).length;

    const { data: { user } } = await supabase.auth.getUser();

    const { data: picklist, error: picklistError } = await supabase
      .from('picklists')
      .insert({
        picklist_code: picklistCode,
        trip_id: trip_id,
        plan_id: trip.plan_id,
        status: 'pending',
        total_lines: totalLines,
        total_quantity: totalQuantity,
        created_by: user?.id,
        created_from: 'trip'
      })
      .select()
      .single();

    if (picklistError || !picklist) {
      console.error('Error creating picklist:', picklistError);
      return NextResponse.json(
        { error: 'Failed to create picklist' },
        { status: 500 }
      );
    }

    // 10. Create picklist items with source_location_id
    // Group items by SKU and stop to avoid duplicates
    const itemsToInsert: any[] = [];

    const skippedItems: any[] = [];

    (orderItems || []).forEach((item) => {
      // Skip items with SKU not in master_sku
      const sku = skuMap.get(item.sku_id);
      if (!sku) {
        console.warn(`Skipping item with missing SKU: ${item.sku_id}`);
        skippedItems.push({
          sku_id: item.sku_id,
          order_item_id: item.order_item_id,
          order_id: item.order_id
        });
        return;
      }

      // Find which stop this order belongs to
      const stop = stops?.find(s => {
        if (s.order_id === item.order_id) return true;
        if (s.tags?.order_ids?.includes(item.order_id)) return true;
        return false;
      });

      if (stop) {
        const order = orderMap.get(item.order_id);

        // Use default_location (preparation area) as source_location_id
        // This is the preparation area configured in master data
        const sourceLocationId = sku.default_location || null;

        itemsToInsert.push({
          picklist_id: picklist.id,
          order_item_id: item.order_item_id,
          sku_id: item.sku_id,
          sku_name: sku.sku_name || item.sku_id,
          uom: sku.uom_base || 'ชิ้น',
          order_no: order?.order_no || '-',
          order_id: item.order_id,
          stop_id: stop.stop_id,
          quantity_to_pick: item.order_qty,
          quantity_picked: 0,
          source_location_id: sourceLocationId,  // ✅ ใช้ default_location (preparation area)
          status: 'pending',
          notes: sku?.barcode || null
        });
      }
    });

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('picklist_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error creating picklist items:', itemsError);
        // Rollback: delete the picklist
        await supabase.from('picklists').delete().eq('id', picklist.id);
        return NextResponse.json(
          { error: 'Failed to create picklist items' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      picklist_id: picklist.id,
      picklist_no: picklistCode,
      total_items: itemsToInsert.length,
      skipped_items: skippedItems.length,
      warnings: skippedItems.length > 0 ? [
        `ข้ามรายการที่ SKU ไม่มีในระบบ: ${skippedItems.length} รายการ`,
        `SKU ที่ไม่มี: ${[...new Set(skippedItems.map(i => i.sku_id))].join(', ')}`
      ] : []
    });

  } catch (error: any) {
    console.error('Error in POST /api/picklists/create-from-trip:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

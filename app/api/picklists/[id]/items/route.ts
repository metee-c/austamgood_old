import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const picklistId = (await params).id;

    const { data: items, error } = await supabase
      .from('picklist_items')
      .select(`
        id,
        sku_id,
        stop_id,
        order_item_id,
        quantity_to_pick,
        quantity_picked,
        source_location_id,
        status,
        notes
      `)
      .eq('picklist_id', picklistId)
      .order('stop_id', { ascending: true });

    if (error) {
      console.error('Error fetching picklist items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stopIds = [...new Set(items.map(i => i.stop_id))];
    const skuIds = [...new Set(items.map(i => i.sku_id))];
    const locationIds = [...new Set(items.filter(i => i.source_location_id).map(i => i.source_location_id))];
    const orderItemIds = [...new Set(items.map(i => i.order_item_id))];

    const [stopsResult, skusResult, locationsResult, orderItemsResult] = await Promise.all([
      supabase.from('receiving_route_stops').select('stop_id, sequence_no, stop_name, address, customer_id, order_id, tags').in('stop_id', stopIds),
      supabase.from('master_sku').select('sku_id, sku_name, uom_base, default_location, weight_per_piece_kg').in('sku_id', skuIds),
      locationIds.length > 0
        ? supabase.from('master_location').select('location_id').in('location_id', locationIds)
        : { data: [], error: null },
      supabase.from('wms_order_items').select('order_item_id, order_id').in('order_item_id', orderItemIds)
    ]);

    // Get customer IDs from stops to check for no_price_goods
    const customerIds = [...new Set((stopsResult.data || [])
      .filter((s: any) => s.customer_id)
      .map((s: any) => s.customer_id))];

    // Query master_customer_no_price_goods for matching customers
    const noPriceGoodsResult = customerIds.length > 0
      ? await supabase
          .from('master_customer_no_price_goods')
          .select('customer_id, note_for_picking')
          .in('customer_id', customerIds)
          .eq('is_active', true)
      : { data: [], error: null };

    // Create map of customer_id -> note_for_picking
    const noPriceGoodsMap = new Map((noPriceGoodsResult.data || []).map((r: any) => [r.customer_id, r.note_for_picking]));

    const orderIds = [...new Set((orderItemsResult.data || []).map((oi: any) => oi.order_id))];
    
    // Also collect order IDs from stops (for shop_name lookup)
    const stopOrderIds = [...new Set((stopsResult.data || [])
      .filter((s: any) => s.order_id)
      .map((s: any) => s.order_id))];
    
    // Collect order IDs from stop tags
    (stopsResult.data || []).forEach((s: any) => {
      if (s.tags?.order_ids && Array.isArray(s.tags.order_ids)) {
        s.tags.order_ids.forEach((id: number) => stopOrderIds.push(id));
      }
    });
    
    // Combine all order IDs
    const allOrderIds = [...new Set([...orderIds, ...stopOrderIds])];
    
    // Fetch orders with shop_name
    const ordersResult = await supabase.from('wms_orders').select('order_id, order_no, shop_name').in('order_id', allOrderIds);

    // Get unique default_location values from SKUs to fetch preparation area names
    const defaultLocationIds = [...new Set((skusResult.data || [])
      .filter((s: any) => s.default_location)
      .map((s: any) => s.default_location))];
    
    const preparationAreasResult = defaultLocationIds.length > 0
      ? await supabase.from('preparation_area').select('area_id, area_name').in('area_id', defaultLocationIds)
      : { data: [], error: null };

    const stopMap = new Map((stopsResult.data || []).map((s: any) => [s.stop_id, s]));
    const skuMap = new Map((skusResult.data || []).map((s: any) => [s.sku_id, s]));
    const locationMap = new Map((locationsResult.data || []).map((l: any) => [l.location_id, l]));
    const orderItemMap = new Map((orderItemsResult.data || []).map((oi: any) => [oi.order_item_id, oi]));
    const orderMap = new Map((ordersResult.data || []).map((o: any) => [o.order_id, o]));
    const preparationAreaMap = new Map((preparationAreasResult.data || []).map((a: any) => [a.area_id, a]));
    
    // Create map of stop_id -> customer_id for no_price_goods lookup
    const stopCustomerMap = new Map((stopsResult.data || []).map((s: any) => [s.stop_id, s.customer_id]));

    const groupedItems = new Map<string, any>();

    console.log('Processing items:', items.length);

    items.forEach((item: any) => {
      const groupKey = `${item.stop_id}_${item.sku_id}`;
      const stop = stopMap.get(item.stop_id);
      const sku = skuMap.get(item.sku_id);
      const location = item.source_location_id ? locationMap.get(item.source_location_id) : null;
      const orderItem = orderItemMap.get(item.order_item_id);
      const order = orderItem ? orderMap.get(orderItem.order_id) : null;

      const orderNo = order?.order_no || '-';
      
      // Get shop_name from order - prioritize shop_name over stop_name
      // First try to get from the order associated with this item
      let customerName = order?.shop_name || null;
      
      // If not found, try to get from the stop's primary order
      if (!customerName && stop?.order_id) {
        const stopOrder = orderMap.get(stop.order_id);
        customerName = stopOrder?.shop_name || null;
      }
      
      // If still not found, try to get from the first order in stop's tags
      if (!customerName && stop?.tags?.order_ids && Array.isArray(stop.tags.order_ids) && stop.tags.order_ids.length > 0) {
        const firstOrderId = stop.tags.order_ids[0];
        const firstOrder = orderMap.get(firstOrderId);
        customerName = firstOrder?.shop_name || null;
      }
      
      // Fallback to stop_name if no shop_name found
      if (!customerName) {
        customerName = stop?.stop_name || '-';
      }
      
      console.log(`Processing item: stop=${item.stop_id}, sku=${item.sku_id}, order=${orderNo}, qty=${item.quantity_to_pick}`);

      if (!groupedItems.has(groupKey)) {
        console.log(`Creating new group: ${groupKey}`);
        
        // Determine source location display value - use location_id
        let sourceLocationDisplay = '-';
        if (location?.location_id) {
          // If there's a specific location assigned, use location_id
          sourceLocationDisplay = location.location_id;
        } else if (sku?.default_location) {
          // Otherwise, use the default location from SKU (preparation area ID)
          sourceLocationDisplay = sku.default_location;
        }

        // Check if this stop's customer has no_price_goods requirement
        const customerId = stopCustomerMap.get(item.stop_id);
        const noPriceGoodsNote = customerId ? noPriceGoodsMap.get(customerId) : null;
        
        groupedItems.set(groupKey, {
          id: item.id,
          sku_id: item.sku_id,
          sku_name: sku?.sku_name || item.sku_id,
          uom: sku?.uom_base || 'ชิ้น',
          source_location: sourceLocationDisplay,
          status: item.status,
          notes: item.notes,
          order_nos: [orderNo],
          quantities_to_pick: [item.quantity_to_pick],
          quantities_picked: [item.quantity_picked],
          no_price_goods_note: noPriceGoodsNote || null,
          weight_per_piece_kg: sku?.weight_per_piece_kg || 0,
          stop: {
            stop_id: item.stop_id,
            stop_sequence: stop?.sequence_no || 0,
            customer_name: customerName,
            customer_address: stop?.address || '-'
          }
        });
      } else {
        console.log(`Adding to existing group: ${groupKey}`);
        const existingGroup = groupedItems.get(groupKey);
        existingGroup.order_nos.push(orderNo);
        existingGroup.quantities_to_pick.push(item.quantity_to_pick);
        existingGroup.quantities_picked.push(item.quantity_picked);
      }
    });

    console.log('Final grouped items count:', groupedItems.size);

    const enrichedItems = Array.from(groupedItems.values()).map((group: any) => ({
      ...group,
      order_no: group.order_nos.join('/'),
      quantity_to_pick: group.quantities_to_pick.join('/'),
      quantity_picked: group.quantities_picked.join('/'),
      total_quantity_to_pick: group.quantities_to_pick.reduce((sum: number, qty: number) => sum + qty, 0),
      total_quantity_picked: group.quantities_picked.reduce((sum: number, qty: number) => sum + qty, 0)
    }));

    return NextResponse.json(enrichedItems);
  } catch (error: any) {
    console.error('Error in GET /api/picklists/[id]/items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);

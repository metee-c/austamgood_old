import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
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
      supabase.from('receiving_route_stops').select('stop_id, sequence_no, stop_name, address').in('stop_id', stopIds),
      supabase.from('master_sku').select('sku_id, sku_name, uom_base, default_location').in('sku_id', skuIds),
      locationIds.length > 0
        ? supabase.from('master_location').select('location_id').in('location_id', locationIds)
        : { data: [], error: null },
      supabase.from('wms_order_items').select('order_item_id, order_id').in('order_item_id', orderItemIds)
    ]);

    const orderIds = [...new Set((orderItemsResult.data || []).map((oi: any) => oi.order_id))];
    const ordersResult = await supabase.from('wms_orders').select('order_id, order_no').in('order_id', orderIds);

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
          stop: {
            stop_id: item.stop_id,
            stop_sequence: stop?.sequence_no || 0,
            customer_name: stop?.stop_name || '-',
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

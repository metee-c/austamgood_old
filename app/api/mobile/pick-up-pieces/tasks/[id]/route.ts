import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/mobile/pick-up-pieces/tasks/[id]
 * ดึงรายละเอียด Picklist พร้อม items สำหรับหยิบรายชิ้น
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: picklist, error } = await supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        loading_door_number,
        created_at,
        updated_at,
        trip:trip_id (
          trip_code,
          vehicle:vehicle_id (
            plate_number
          )
        ),
        plan:plan_id (
          plan_code,
          plan_name,
          warehouse_id
        ),
        picklist_items (
          id,
          sku_id,
          sku_name,
          uom,
          order_no,
          order_id,
          stop_id,
          quantity_to_pick,
          quantity_picked,
          source_location_id,
          status,
          notes,
          master_sku (
            sku_name,
            barcode,
            qty_per_pack
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching picklist:', error);
      return NextResponse.json(
        { error: 'Picklist not found', details: error.message },
        { status: 404 }
      );
    }

    // Map source_location_id (area_code) to zone name for display
    if (picklist?.picklist_items) {
      const areaCodeSet = new Set(
        picklist.picklist_items
          .map(item => item.source_location_id)
          .filter(Boolean)
      );

      if (areaCodeSet.size > 0) {
        const { data: prepAreas } = await supabase
          .from('preparation_area')
          .select('area_code, area_name, zone')
          .in('area_code', Array.from(areaCodeSet));

        const areaMap = new Map(
          (prepAreas || []).map(area => [
            area.area_code,
            { area_name: area.area_name, zone: area.zone }
          ])
        );

        // Add location info to each item
        picklist.picklist_items = picklist.picklist_items.map(item => ({
          ...item,
          master_location: item.source_location_id
            ? {
                location_code: areaMap.get(item.source_location_id)?.zone || item.source_location_id,
                location_name: areaMap.get(item.source_location_id)?.area_name || null
              }
            : null
        }));
      }

      // Fetch shop names from orders (prioritize shop_name over stop_name)
      const stopIds = [...new Set(picklist.picklist_items.map(item => item.stop_id).filter(Boolean))];
      if (stopIds.length > 0) {
        const { data: stops } = await supabase
          .from('receiving_route_stops')
          .select('stop_id, stop_name, order_id, tags')
          .in('stop_id', stopIds);

        // Collect all order IDs from stops
        const orderIds = new Set<number>();
        (stops || []).forEach(stop => {
          if (stop.order_id) orderIds.add(stop.order_id);
          if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
            stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
          }
        });

        // Also collect order IDs from picklist items
        picklist.picklist_items.forEach(item => {
          if (item.order_id) orderIds.add(item.order_id);
        });

        // Fetch orders with shop_name
        let orderMap = new Map<number, any>();
        if (orderIds.size > 0) {
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('order_id, shop_name')
            .in('order_id', Array.from(orderIds));
          
          orderMap = new Map((orders || []).map(o => [o.order_id, o]));
        }

        const stopMap = new Map(
          (stops || []).map(stop => [stop.stop_id, { stop_name: stop.stop_name, order_id: stop.order_id, tags: stop.tags }])
        );

        picklist.picklist_items = picklist.picklist_items.map(item => {
          const stop = item.stop_id ? stopMap.get(item.stop_id) : null;
          
          // Priority: 1. shop_name from item's order, 2. shop_name from stop's order, 3. stop_name
          let shopName = null;
          
          // Try item's order first
          if (item.order_id) {
            const order = orderMap.get(item.order_id);
            shopName = order?.shop_name || null;
          }
          
          // Try stop's primary order
          if (!shopName && stop?.order_id) {
            const order = orderMap.get(stop.order_id);
            shopName = order?.shop_name || null;
          }
          
          // Try first order from stop's tags
          if (!shopName && stop?.tags?.order_ids && Array.isArray(stop.tags.order_ids) && stop.tags.order_ids.length > 0) {
            const order = orderMap.get(stop.tags.order_ids[0]);
            shopName = order?.shop_name || null;
          }
          
          // Fallback to stop_name
          if (!shopName) {
            shopName = stop?.stop_name || null;
          }
          
          return {
            ...item,
            shop_name: shopName
          };
        });
      }
    }

    return NextResponse.json(picklist);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

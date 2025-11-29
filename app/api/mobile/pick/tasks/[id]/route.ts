import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/mobile/pick/tasks/[id]
 * ดึงรายละเอียด Picklist พร้อม items
 */
export async function GET(
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

    // ✅ Map source_location_id (area_code) to zone name for display
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

      // ✅ Fetch shop names from stops
      const stopIds = [...new Set(picklist.picklist_items.map(item => item.stop_id).filter(Boolean))];
      if (stopIds.length > 0) {
        const { data: stops } = await supabase
          .from('receiving_route_stops')
          .select('stop_id, stop_name, order_id')
          .in('stop_id', stopIds);

        const stopMap = new Map(
          (stops || []).map(stop => [stop.stop_id, { stop_name: stop.stop_name, order_id: stop.order_id }])
        );

        picklist.picklist_items = picklist.picklist_items.map(item => ({
          ...item,
          shop_name: item.stop_id ? stopMap.get(item.stop_id)?.stop_name : null
        }));
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

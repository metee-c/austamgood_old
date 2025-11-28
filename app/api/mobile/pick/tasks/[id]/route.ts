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
          quantity_to_pick,
          quantity_picked,
          source_location_id,
          status,
          notes,
          master_sku (
            sku_name,
            barcode,
            qty_per_pack
          ),
          master_location:source_location_id (
            location_code,
            location_name
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

    return NextResponse.json(picklist);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

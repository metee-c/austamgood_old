import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/mobile/face-sheet/tasks/[id]
 * ดึงข้อมูล Face Sheet สำหรับหน้า Mobile Pick
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch face sheet with items
    const { data: faceSheet, error } = await supabase
      .from('face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        warehouse_id,
        created_date,
        total_packages,
        total_items,
        face_sheet_items (
          id,
          sku_id,
          product_code,
          product_name,
          quantity,
          quantity_to_pick,
          quantity_picked,
          source_location_id,
          status,
          uom,
          order_id,
          package_id,
          face_sheet_packages (
            id,
            package_number,
            barcode_id
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching face sheet:', error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    // Transform data to match mobile pick format
    const transformedData = {
      id: faceSheet.id,
      face_sheet_no: faceSheet.face_sheet_no,
      status: faceSheet.status,
      warehouse_id: faceSheet.warehouse_id,
      created_date: faceSheet.created_date,
      total_packages: faceSheet.total_packages,
      total_items: faceSheet.total_items,
      items: (faceSheet.face_sheet_items || []).map((item: any) => ({
        id: item.id,
        sku_id: item.sku_id || item.product_code,
        sku_name: item.product_name,
        quantity_to_pick: item.quantity_to_pick || item.quantity,
        quantity_picked: item.quantity_picked || 0,
        source_location_id: item.source_location_id,
        status: item.status || 'pending',
        uom: item.uom || 'ชิ้น',
        order_id: item.order_id,
        package_number: item.face_sheet_packages?.[0]?.package_number,
        barcode_id: item.face_sheet_packages?.[0]?.barcode_id
      }))
    };

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error('API Error in GET /api/mobile/face-sheet/tasks/[id]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

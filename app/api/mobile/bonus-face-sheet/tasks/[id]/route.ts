import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/mobile/bonus-face-sheet/tasks/[id]
 * ดึงข้อมูล Bonus Face Sheet พร้อม items สำหรับหน้า Mobile Pick
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const bonusFaceSheetId = parseInt(id);

    if (isNaN(bonusFaceSheetId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    // ดึงข้อมูล Bonus Face Sheet
    const { data: bonusFaceSheet, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        warehouse_id,
        status,
        delivery_date,
        total_packages,
        total_items,
        total_orders,
        created_date,
        checker_employee_ids,
        picker_employee_ids,
        picking_started_at,
        picking_completed_at
      `)
      .eq('id', bonusFaceSheetId)
      .single();

    if (bonusFaceSheetError || !bonusFaceSheet) {
      console.error('Error fetching bonus face sheet:', bonusFaceSheetError);
      return NextResponse.json(
        { success: false, error: 'ไม่พบใบปะหน้าของแถม' },
        { status: 404 }
      );
    }

    // ดึงข้อมูล items พร้อม package info
    const { data: items, error: itemsError } = await supabase
      .from('bonus_face_sheet_items')
      .select(`
        id,
        sku_id,
        product_name,
        quantity_to_pick,
        quantity_picked,
        status,
        package_id,
        bonus_face_sheet_packages (
          package_number,
          barcode_id,
          order_id,
          order_no,
          shop_name
        )
      `)
      .eq('face_sheet_id', bonusFaceSheetId)
      .order('package_id', { ascending: true })
      .order('id', { ascending: true });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูลรายการได้' },
        { status: 500 }
      );
    }

    // จัดรูปแบบข้อมูล items
    const formattedItems = (items || []).map(item => {
      const pkg = item.bonus_face_sheet_packages as any;
      return {
        id: item.id,
        sku_id: item.sku_id,
        product_name: item.product_name,
        quantity_to_pick: item.quantity_to_pick,
        quantity_picked: item.quantity_picked,
        status: item.status,
        package_number: pkg?.package_number,
        barcode_id: pkg?.barcode_id,
        order_id: pkg?.order_id,
        order_no: pkg?.order_no,
        shop_name: pkg?.shop_name
      };
    });

    const responseData = {
      ...bonusFaceSheet,
      items: formattedItems
    };

    return NextResponse.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error('Error in GET /api/mobile/bonus-face-sheet/tasks/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

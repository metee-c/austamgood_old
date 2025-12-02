import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'กรุณาระบุเลขใบโหลด' },
        { status: 400 }
      );
    }

    // Get loadlist basic info
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select('id, loadlist_code, status')
      .eq('loadlist_code', code.toUpperCase())
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json(
        { error: 'ไม่พบใบโหลดนี้', details: loadlistError?.message },
        { status: 404 }
      );
    }

    // Check if already loaded
    if (loadlist.status === 'loaded') {
      return NextResponse.json(
        { error: 'ใบโหลดนี้โหลดเสร็จแล้ว' },
        { status: 400 }
      );
    }

    let totalWeight = 0;
    const ordersMap = new Map();

    // Get picklists
    const { data: picklistData } = await supabase
      .from('loadlist_picklists')
      .select(`
        picklist_id,
        picklists:picklist_id (
          picklist_code,
          picklist_items (
            order_id,
            order_no,
            sku_id,
            quantity_picked,
            quantity_to_pick,
            master_sku:sku_id (
              sku_name,
              weight_per_piece_kg
            ),
            wms_orders:order_id (
              order_id,
              order_no,
              shop_name
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist.id);

    // Process picklist items
    for (const lp of picklistData || []) {
      const picklist = lp.picklists as any;
      if (!picklist) continue;

      for (const item of picklist.picklist_items || []) {
        const qty = item.quantity_picked || item.quantity_to_pick || 0;
        const weight = item.master_sku?.weight_per_piece_kg || 0;
        totalWeight += qty * weight;

        if (item.wms_orders && item.order_id) {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              order_code: item.wms_orders.order_no || item.order_no,
              customer_name: item.wms_orders.shop_name || '-',
              items: []
            });
          }
          const orderData = ordersMap.get(item.order_id);
          orderData.items.push({
            sku_name: item.master_sku?.sku_name || '-',
            quantity: qty,
            weight: weight
          });
        }
      }
    }

    // Get face sheets
    const { data: faceSheetData } = await supabase
      .from('loadlist_face_sheets')
      .select(`
        face_sheet_id,
        face_sheets:face_sheet_id (
          face_sheet_no,
          face_sheet_items (
            sku_id,
            quantity,
            order_id,
            master_sku:sku_id (
              sku_name,
              weight_per_piece_kg
            ),
            wms_orders:order_id (
              order_id,
              order_no,
              shop_name
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist.id);

    // Process face sheet items
    for (const fs of faceSheetData || []) {
      const faceSheet = fs.face_sheets as any;
      if (!faceSheet) continue;

      for (const item of faceSheet.face_sheet_items || []) {
        const qty = item.quantity || 0;
        const weight = item.master_sku?.weight_per_piece_kg || 0;
        totalWeight += qty * weight;

        if (item.wms_orders && item.order_id) {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              order_code: item.wms_orders.order_no,
              customer_name: item.wms_orders.shop_name || '-',
              items: []
            });
          }
          const orderData = ordersMap.get(item.order_id);
          orderData.items.push({
            sku_name: item.master_sku?.sku_name || '-',
            quantity: qty,
            weight: weight
          });
        }
      }
    }

    const orders = Array.from(ordersMap.values());

    return NextResponse.json({
      success: true,
      data: {
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_weight: totalWeight,
        orders
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

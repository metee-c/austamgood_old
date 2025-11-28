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

    // Get loadlist with picklists and orders
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        wms_loadlist_picklists (
          picklist_id,
          picklists (
            picklist_code,
            trip_id,
            picklist_items (
              order_id,
              order_no,
              sku_id,
              quantity_picked,
              quantity_to_pick,
              master_sku (
                sku_name,
                weight_per_piece_kg
              ),
              wms_orders (
                order_id,
                order_no,
                shop_name,
                total_weight
              )
            )
          )
        )
      `)
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

    // Calculate total weight and extract unique orders with items
    let totalWeight = 0;
    const ordersMap = new Map();

    for (const lp of loadlist.wms_loadlist_picklists || []) {
      const picklist = lp.picklists as any;
      if (!picklist) continue;

      // Extract unique orders from picklist items
      for (const item of picklist.picklist_items || []) {
        const qty = item.quantity_picked || item.quantity_to_pick || 0;
        const weight = item.master_sku?.weight_per_piece_kg || 0;
        totalWeight += qty * weight;

        // Add order to map (using order_id as key to avoid duplicates)
        if (item.wms_orders && item.order_id) {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              order_code: item.wms_orders.order_no || item.order_no,
              customer_name: item.wms_orders.shop_name || '-',
              items: []
            });
          }
          // Add SKU item to this order
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

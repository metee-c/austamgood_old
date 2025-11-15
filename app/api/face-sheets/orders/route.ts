import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deliveryDate = searchParams.get('delivery_date');

  if (!deliveryDate) {
    return NextResponse.json(
      { success: false, error: 'delivery_date is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select(
        'order_id, order_no, customer_id, shop_name, delivery_date, province'
      )
      .eq('order_type', 'express')
      .eq('delivery_date', deliveryDate)
      .eq('status', 'draft')
      .order('order_no', { ascending: true });

    if (ordersError) {
      console.error('Error fetching express orders:', ordersError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถโหลดออเดอร์ได้', details: ordersError.message },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const orderIds = orders.map((order) => order.order_id);

    const { data: items, error: itemsError } = await supabase
      .from('wms_order_items')
      .select('order_id, order_item_id, order_qty')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถโหลดรายละเอียดสินค้าได้', details: itemsError.message },
        { status: 500 }
      );
    }

    const itemsByOrderId = new Map<number, { totalSku: number; totalQuantity: number }>();

    (items || []).forEach((item) => {
      const summary = itemsByOrderId.get(item.order_id) || { totalSku: 0, totalQuantity: 0 };
      summary.totalSku += 1;
      summary.totalQuantity += Number(item.order_qty) || 0;
      itemsByOrderId.set(item.order_id, summary);
    });

    const previewOrders = orders.map((order) => {
      const summary = itemsByOrderId.get(order.order_id) || { totalSku: 0, totalQuantity: 0 };
      return {
        order_id: order.order_id,
        order_no: order.order_no,
        customer_id: order.customer_id,
        shop_name: order.shop_name,
        delivery_date: order.delivery_date,
        province: order.province,
        total_sku: summary.totalSku,
        total_items: summary.totalQuantity,
      };
    });

    return NextResponse.json({ success: true, data: previewOrders });
  } catch (error) {
    console.error('Unexpected error fetching preview orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการโหลดออเดอร์',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: stopId } = await params;
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    // Get stop information
    const { data: stop, error: stopError } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .eq('stop_id', stopId)
      .single();

    if (stopError || !stop) {
      console.error('Stop not found:', { stopId, error: stopError });
      return NextResponse.json(
        { data: null, error: 'ไม่พบข้อมูล stop' },
        { status: 404 }
      );
    }

    // If order_id is provided, get specific order's items
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('wms_orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { data: null, error: 'ไม่พบข้อมูล order' },
          { status: 404 }
        );
      }

      // Get order items
      const { data: items, error: itemsError } = await supabase
        .from('wms_order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('line_no', { ascending: true });

      if (itemsError) {
        return NextResponse.json(
          { data: null, error: itemsError.message },
          { status: 500 }
        );
      }

      // Calculate available weight and qty (total order - already allocated)
      const itemsWithAvailable = items?.map(item => ({
        ...item,
        available_weight: item.order_weight || 0,
        available_qty: item.order_qty || 0,
        unit_weight: item.order_weight && item.order_qty
          ? (item.order_weight / item.order_qty)
          : null
      })) || [];

      return NextResponse.json({
        data: {
          ...order,
          items: itemsWithAvailable
        },
        error: null
      });
    }

    // If no order_id, return stop info with all orders in this stop
    const { data: stopOrders, error: stopOrdersError } = await supabase
      .from('receiving_route_stops')
      .select(`
        *,
        order:wms_orders(
          *,
          items:wms_order_items(*)
        )
      `)
      .eq('stop_id', stopId);

    if (stopOrdersError) {
      return NextResponse.json(
        { data: null, error: stopOrdersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: stopOrders?.[0] || null,
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching stop order details:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

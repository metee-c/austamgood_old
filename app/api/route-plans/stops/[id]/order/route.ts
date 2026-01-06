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

    // Determine which order_id to use
    // Priority: 1) order_id from query param, 2) stop.order_id, 3) first order from tags.order_ids
    let targetOrderId = orderId;
    
    if (!targetOrderId) {
      // Check if stop has order_id directly
      if (stop.order_id) {
        targetOrderId = String(stop.order_id);
      } 
      // Check if stop has order_ids in tags (consolidated stop)
      else if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids) && stop.tags.order_ids.length > 0) {
        targetOrderId = String(stop.tags.order_ids[0]);
      }
    }

    // If we have a target order_id, get that order's items
    if (targetOrderId) {
      const { data: order, error: orderError } = await supabase
        .from('wms_orders')
        .select('*')
        .eq('order_id', targetOrderId)
        .single();

      if (orderError || !order) {
        console.error('Order not found:', { targetOrderId, error: orderError });
        return NextResponse.json(
          { data: null, error: 'ไม่พบข้อมูล order' },
          { status: 404 }
        );
      }

      // Get order items
      const { data: items, error: itemsError } = await supabase
        .from('wms_order_items')
        .select('*')
        .eq('order_id', targetOrderId)
        .order('line_no', { ascending: true });

      if (itemsError) {
        console.error('Error fetching order items:', { targetOrderId, error: itemsError });
        return NextResponse.json(
          { data: null, error: itemsError.message },
          { status: 500 }
        );
      }

      console.log('📦 Fetched order items for split modal:', {
        stopId,
        targetOrderId,
        orderNo: order.order_no,
        itemsCount: items?.length || 0
      });

      // Calculate available weight and qty (total order - already allocated)
      const itemsWithAvailable = items?.map(item => ({
        ...item,
        available_weight: Number(item.order_weight) || 0,
        available_qty: Number(item.order_qty) || 0,
        unit_weight: item.order_weight && item.order_qty && Number(item.order_qty) > 0
          ? (Number(item.order_weight) / Number(item.order_qty))
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

    // If still no order_id found, return stop info without items
    console.warn('No order_id found for stop:', { stopId, stop_order_id: stop.order_id, tags: stop.tags });
    
    return NextResponse.json({
      data: {
        ...stop,
        items: []
      },
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

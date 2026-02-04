import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(
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

      // First, check if this stop has allocated items in receiving_route_stop_items
      const { data: allocatedItems, error: allocatedError } = await supabase
        .from('receiving_route_stop_items')
        .select('*')
        .eq('stop_id', stopId)
        .eq('order_id', targetOrderId);

      if (!allocatedError && allocatedItems && allocatedItems.length > 0) {
        // This stop has specific item allocations - use them
        console.log('📦 Using allocated items from receiving_route_stop_items:', {
          stopId,
          targetOrderId,
          allocatedItemsCount: allocatedItems.length
        });

        const itemsWithAvailable = allocatedItems.map(item => ({
          order_item_id: item.order_item_id,
          sku_id: item.sku_id,
          sku_name: item.sku_name,
          order_qty: Number(item.allocated_quantity) || 0,
          order_weight: Number(item.allocated_weight_kg) || 0,
          available_weight: Number(item.allocated_weight_kg) || 0,
          available_qty: Number(item.allocated_quantity) || 0,
          unit_weight: item.allocated_quantity && Number(item.allocated_quantity) > 0
            ? (Number(item.allocated_weight_kg) / Number(item.allocated_quantity))
            : null
        }));

        return NextResponse.json({
          data: {
            ...order,
            items: itemsWithAvailable,
            has_split_allocation: true
          },
          error: null
        });
      }

      // No specific allocations - check if this stop was created from a split
      // If so, only show the items that were split to this stop
      const splitItemIds = stop.tags?.split_item_ids;
      if (splitItemIds && Array.isArray(splitItemIds) && splitItemIds.length > 0) {
        // This stop was created from a split - only show the split items
        const { data: splitItems, error: splitItemsError } = await supabase
          .from('wms_order_items')
          .select('*')
          .in('order_item_id', splitItemIds)
          .order('line_no', { ascending: true });

        if (!splitItemsError && splitItems) {
          console.log('📦 Using split_item_ids from tags:', {
            stopId,
            targetOrderId,
            splitItemIds,
            itemsCount: splitItems.length
          });

          const itemsWithAvailable = splitItems.map(item => ({
            ...item,
            available_weight: Number(item.order_weight) || 0,
            available_qty: Number(item.order_qty) || 0,
            unit_weight: item.order_weight && item.order_qty && Number(item.order_qty) > 0
              ? (Number(item.order_weight) / Number(item.order_qty))
              : null
          }));

          return NextResponse.json({
            data: {
              ...order,
              items: itemsWithAvailable,
              is_split_stop: true
            },
            error: null
          });
        }
      }

      // Check if this stop has items that were split out to other stops
      const splitOutItemIds = stop.tags?.split_out_item_ids;
      
      // Get all order items
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

      // Filter out items that were split to other stops
      let filteredItems = items || [];
      if (splitOutItemIds && Array.isArray(splitOutItemIds) && splitOutItemIds.length > 0) {
        // Check if there are other stops with these items
        // For now, we'll still show all items but mark which ones were split
        console.log('📦 Stop has split_out_item_ids:', {
          stopId,
          splitOutItemIds
        });
      }

      console.log('📦 Fetched order items for split modal:', {
        stopId,
        targetOrderId,
        orderNo: order.order_no,
        itemsCount: filteredItems.length,
        hasSplitOutItems: !!splitOutItemIds
      });

      // Calculate available weight and qty
      const itemsWithAvailable = filteredItems.map(item => ({
        ...item,
        available_weight: Number(item.order_weight) || 0,
        available_qty: Number(item.order_qty) || 0,
        unit_weight: item.order_weight && item.order_qty && Number(item.order_qty) > 0
          ? (Number(item.order_weight) / Number(item.order_qty))
          : null
      }));

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

export const GET = withShadowLog(_GET);

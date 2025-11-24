import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get route plans with status 'optimizing' or 'published'
    // optimizing = กำลังกรอกค่าขนส่ง, published = กรอกค่าขนส่งครบแล้ว
    const { data: plans, error } = await supabase
      .from('receiving_route_plans')
      .select(`
        plan_id,
        plan_code,
        plan_name,
        plan_date,
        status,
        warehouse_id,
        total_trips,
        total_distance_km,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .in('status', ['optimizing', 'published'])
      .order('plan_date', { ascending: false })
      .order('plan_code', { ascending: false });

    if (error) {
      console.error('Error fetching published plans:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // For each plan, fetch trips with their stops and orders
    const plansWithTrips = await Promise.all(
      (plans || []).map(async (plan) => {
        // Fetch trips for this plan
        const { data: trips, error: tripsError } = await supabase
          .from('receiving_route_trips')
          .select('trip_id, trip_sequence, vehicle_id, driver_id, shipping_cost, total_distance_km, total_weight_kg, notes, pricing_mode, base_price, helper_fee, extra_stop_fee, supplier_id')
          .eq('plan_id', plan.plan_id)
          .order('trip_sequence', { ascending: true });

        if (tripsError) {
          console.error('Error fetching trips:', tripsError);
          return { ...plan, trips: [] };
        }

        // For each trip, fetch stops with orders
        const tripsWithStops = await Promise.all(
          (trips || []).map(async (trip) => {
            const { data: stops, error: stopsError } = await supabase
              .from('receiving_route_stops')
              .select(`
                stop_id,
                stop_name,
                order_id,
                load_weight_kg,
                tags,
                address,
                latitude,
                longitude
              `)
              .eq('trip_id', trip.trip_id)
              .order('sequence_no', { ascending: true });

            if (stopsError) {
              console.error('Error fetching stops:', stopsError);
              return { ...trip, stops: [] };
            }

            // Collect all order IDs from stops
            const orderIds = new Set<number>();
            (stops || []).forEach((stop) => {
              if (stop.order_id) orderIds.add(stop.order_id);
              if (stop.tags?.order_ids) {
                stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
              }
            });

            // Fetch order details
            let orders: any[] = [];
            let orderItemsMap: Record<number, number> = {};

            if (orderIds.size > 0) {
              const { data: ordersData, error: ordersError } = await supabase
                .from('wms_orders')
                .select('order_id, order_no, customer_id, total_weight')
                .in('order_id', Array.from(orderIds));

              if (!ordersError && ordersData) {
                orders = ordersData;
                console.log('🔍 Orders data with customer_id:', {
                  ordersCount: ordersData.length,
                  firstOrder: ordersData[0],
                  sampleCustomerIds: ordersData.slice(0, 3).map(o => ({
                    order_id: o.order_id,
                    order_no: o.order_no,
                    customer_id: o.customer_id
                  }))
                });
              }

              // Fetch order items to get total quantity for each order
              const { data: orderItemsData, error: orderItemsError } = await supabase
                .from('wms_order_items')
                .select('order_id, order_qty')
                .in('order_id', Array.from(orderIds));

              if (!orderItemsError && orderItemsData) {
                // Sum quantities by order_id
                orderItemsMap = orderItemsData.reduce((acc: any, item: any) => {
                  if (!acc[item.order_id]) {
                    acc[item.order_id] = 0;
                  }
                  acc[item.order_id] += item.order_qty || 0;
                  return acc;
                }, {});
              }
            }

            // Map stops with their order details
            const stopsWithOrders = (stops || []).map((stop) => {
              const stopOrderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
              const stopOrders = orders.filter((o) => stopOrderIds.includes(o.order_id));

              return {
                ...stop,
                orders: stopOrders.map((order) => ({
                  order_id: order.order_id,
                  order_no: order.order_no,
                  customer_id: order.customer_id,
                  stop_name: stop.stop_name,
                  total_qty: orderItemsMap[order.order_id] || 0,
                  weight: order.total_weight || 0
                }))
              };
            });

            return { ...trip, stops: stopsWithOrders };
          })
        );

        return { ...plan, trips: tripsWithStops };
      })
    );

    return NextResponse.json({ data: plansWithTrips || [], error: null });
  } catch (error: any) {
    console.error('Error fetching published plans:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

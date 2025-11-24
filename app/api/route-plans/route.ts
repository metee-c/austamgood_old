import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Fetch route plans with warehouse data
    let query = supabase
      .from('receiving_route_plans')
      .select(`
        *,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('Error fetching route plans:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Fetch trips and orders for each plan
    const plansWithTrips = await Promise.all(
      (plans || []).map(async (plan) => {
        try {
          // Fetch trips for this plan
          const { data: trips, error: tripsError } = await supabase
            .from('receiving_route_trips')
            .select('*')
            .eq('plan_id', plan.plan_id)
            .order('trip_sequence', { ascending: true });

          if (tripsError || !trips) {
            console.error(`Error fetching trips for plan ${plan.plan_id}:`, tripsError);
            return { ...plan, trips: [] };
          }

        // Fetch stops and orders for each trip
        const tripsWithDetails = await Promise.all(
          trips.map(async (trip) => {
            // Fetch stops
            const { data: stops, error: stopsError } = await supabase
              .from('receiving_route_stops')
              .select('*')
              .eq('trip_id', trip.trip_id)
              .order('sequence_no', { ascending: true });

            if (stopsError || !stops) {
              console.error(`Error fetching stops for trip ${trip.trip_id}:`, stopsError);
              return { ...trip, stops: [] };
            }

            // Collect all order IDs from all stops
            const orderIds = new Set<number>();
            stops.forEach(stop => {
              if (stop.order_id) orderIds.add(stop.order_id);
              if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
                stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
              }
            });

            // Fetch order details with shop_name and province
            let orders: any[] = [];
            let orderItemsMap: Record<number, number> = {};

            if (orderIds.size > 0) {
              const { data: ordersData, error: ordersError } = await supabase
                .from('wms_orders')
                .select('order_id, order_no, customer_id, shop_name, province, total_weight')
                .in('order_id', Array.from(orderIds));

              if (!ordersError && ordersData) {
                orders = ordersData;
              }

              // Fetch order items count
              const { data: itemsData, error: itemsError } = await supabase
                .from('wms_order_items')
                .select('order_id, order_qty')
                .in('order_id', Array.from(orderIds));

              if (!itemsError && itemsData) {
                itemsData.forEach((item: any) => {
                  orderItemsMap[item.order_id] = (orderItemsMap[item.order_id] || 0) + (item.order_qty || 0);
                });
              }
            }

            // Map orders to stops
            const stopsWithOrders = stops.map(stop => {
              const stopOrderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
              const stopOrders = orders.filter(o => stopOrderIds.includes(o.order_id));

              return {
                ...stop,
                orders: stopOrders.map((order) => ({
                  order_id: order.order_id,
                  order_no: order.order_no,
                  customer_id: order.customer_id,
                  stop_name: stop.stop_name,
                  shop_name: order.shop_name,
                  province: order.province,
                  total_qty: orderItemsMap[order.order_id] || 0,
                  weight: order.total_weight || 0
                }))
              };
            });

            return { ...trip, stops: stopsWithOrders };
          })
        );

          return { ...plan, trips: tripsWithDetails };
        } catch (planError: any) {
          console.error(`Error processing plan ${plan.plan_id}:`, planError);
          console.error('Plan error stack:', planError?.stack);
          return { ...plan, trips: [] };
        }
      })
    );

    console.log('Route plans fetched successfully:', {
      count: plansWithTrips?.length || 0,
      plans: plansWithTrips?.slice(0, 2).map(p => ({
        plan_id: p.plan_id,
        plan_code: p.plan_code,
        status: p.status,
        trips_count: p.trips?.length || 0
      }))
    });

    return NextResponse.json({ data: plansWithTrips || [], error: null });
  } catch (error: any) {
    console.error('Unexpected error fetching route plans:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('receiving_route_plans')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating route plan:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating route plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

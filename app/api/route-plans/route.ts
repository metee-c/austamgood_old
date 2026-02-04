import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // 1. Fetch route plans with warehouse data
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

    if (!plans || plans.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // 2. Get all plan IDs
    const planIds = plans.map(p => p.plan_id);

    // 3. Fetch ALL trips for ALL plans in ONE query (แก้ไข N+1 problem)
    const { data: allTrips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select('*')
      .in('plan_id', planIds)
      .order('plan_id', { ascending: true })
      .order('trip_sequence', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { data: null, error: tripsError.message },
        { status: 500 }
      );
    }

    if (!allTrips || allTrips.length === 0) {
      // ไม่มี trips - return plans เปล่า
      const plansWithTrips = plans.map(plan => ({ ...plan, trips: [] }));
      return NextResponse.json({ data: plansWithTrips, error: null });
    }

    // 4. Get all trip IDs
    const tripIds = allTrips.map(t => t.trip_id);

    // 5. Fetch ALL stops for ALL trips in ONE query (แก้ไข N+1 problem)
    const { data: allStops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .in('trip_id', tripIds)
      .order('trip_id', { ascending: true })
      .order('sequence_no', { ascending: true });

    if (stopsError) {
      console.error('Error fetching stops:', stopsError);
      return NextResponse.json(
        { data: null, error: stopsError.message },
        { status: 500 }
      );
    }

    // 6. Collect all unique order IDs from all stops
    const orderIdsSet = new Set<number>();
    (allStops || []).forEach(stop => {
      if (stop.order_id) orderIdsSet.add(stop.order_id);
      if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
        stop.tags.order_ids.forEach((id: number) => orderIdsSet.add(id));
      }
    });

    const orderIds = Array.from(orderIdsSet);

    // 7. Fetch ALL orders in ONE query (แก้ไข N+1 problem)
    let allOrders: any[] = [];
    let allOrderItems: any[] = [];

    if (orderIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('wms_orders')
        .select('order_id, order_no, customer_id, shop_name, province, total_weight')
        .in('order_id', orderIds);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      } else {
        allOrders = ordersData || [];
      }

      // 8. Fetch ALL order items in ONE query (แก้ไข N+1 problem)
      const { data: itemsData, error: itemsError } = await supabase
        .from('wms_order_items')
        .select('order_id, order_qty')
        .in('order_id', orderIds);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      } else {
        allOrderItems = itemsData || [];
      }
    }

    // 9. Build lookup maps for O(1) access
    const tripsByPlanId = new Map<number, any[]>();
    allTrips.forEach(trip => {
      if (!tripsByPlanId.has(trip.plan_id)) {
        tripsByPlanId.set(trip.plan_id, []);
      }
      tripsByPlanId.get(trip.plan_id)!.push(trip);
    });

    const stopsByTripId = new Map<number, any[]>();
    (allStops || []).forEach(stop => {
      if (!stopsByTripId.has(stop.trip_id)) {
        stopsByTripId.set(stop.trip_id, []);
      }
      stopsByTripId.get(stop.trip_id)!.push(stop);
    });

    const ordersByOrderId = new Map<number, any>();
    allOrders.forEach(order => {
      ordersByOrderId.set(order.order_id, order);
    });

    const itemsQtyByOrderId = new Map<number, number>();
    allOrderItems.forEach(item => {
      const currentQty = itemsQtyByOrderId.get(item.order_id) || 0;
      itemsQtyByOrderId.set(item.order_id, currentQty + (item.order_qty || 0));
    });

    // 10. Assemble data structure using maps (O(n) complexity)
    const plansWithTrips = plans.map(plan => {
      const planTrips = tripsByPlanId.get(plan.plan_id) || [];
      
      const tripsWithDetails = planTrips.map(trip => {
        const tripStops = stopsByTripId.get(trip.trip_id) || [];
        
        const stopsWithOrders = tripStops.map(stop => {
          const stopOrderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
          const stopOrders = stopOrderIds
            .map((orderId: number) => {
              const order = ordersByOrderId.get(orderId);
              if (!order) return null;
              
              return {
                order_id: order.order_id,
                order_no: order.order_no,
                customer_id: order.customer_id,
                stop_name: stop.stop_name,
                shop_name: order.shop_name,
                province: order.province,
                total_qty: itemsQtyByOrderId.get(order.order_id) || 0,
                weight: order.total_weight || 0
              };
            })
            .filter((order: any) => order !== null);

          return {
            ...stop,
            orders: stopOrders
          };
        });

        return {
          ...trip,
          stops: stopsWithOrders
        };
      });

      return {
        ...plan,
        trips: tripsWithDetails
      };
    });

    console.log('Route plans fetched successfully:', {
      count: plansWithTrips?.length || 0,
      totalQueries: 8, // แทนที่จะเป็น 100+ queries
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

async function _POST(request: Request) {
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

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);

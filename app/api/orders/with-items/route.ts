import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Build query - get all orders with items first
    let query = supabase
      .from('wms_orders')
      .select(`
        *,
        items:wms_order_items(*)
      `)
      .order('order_date', { ascending: false });

    // Apply filters
    const orderType = searchParams.get('order_type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const customerId = searchParams.get('customer_id');
    const searchTerm = searchParams.get('searchTerm');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (orderType && orderType !== 'all') {
      query = query.eq('order_type', orderType);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Priority filter removed - column doesn't exist in database
    // if (priority && priority !== 'all') {
    //   query = query.eq('priority', priority);
    // }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (searchTerm) {
      query = query.or(`order_no.ilike.%${searchTerm}%,shop_name.ilike.%${searchTerm}%,customer_id.ilike.%${searchTerm}%`);
    }

    if (startDate) {
      query = query.gte('order_date', startDate);
    }

    if (endDate) {
      query = query.lte('order_date', endDate);
    }

    const { data: ordersData, error } = await query;

    if (error) {
      console.error('Error fetching orders with items:', error);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    // Get unique customer IDs and order IDs from orders
    const customerIds = [...new Set(ordersData?.map(order => order.customer_id).filter(Boolean) || [])];
    const orderIds = ordersData?.map(order => order.order_id).filter(Boolean) || [];

    // Fetch customer coordinates if there are any customer IDs
    let customersMap = new Map();
    if (customerIds.length > 0) {
      const { data: customersData, error: customersError } = await supabase
        .from('master_customer')
        .select('customer_id, latitude, longitude')
        .in('customer_id', customerIds);

      if (!customersError && customersData) {
        customersData.forEach(customer => {
          customersMap.set(customer.customer_id, {
            latitude: customer.latitude,
            longitude: customer.longitude
          });
        });
      } else if (customersError) {
        console.error('Error fetching customers:', customersError);
      }
    }

    // Fetch route plan information for orders via receiving_route_plan_inputs
    let routePlansMap = new Map();
    if (orderIds.length > 0) {
      const { data: routeInputsData, error: routeInputsError } = await supabase
        .from('receiving_route_plan_inputs')
        .select(`
          order_id,
          receiving_route_plans!plan_id (
            plan_code,
            status
          )
        `)
        .in('order_id', orderIds)
        .not('order_id', 'is', null);

      if (!routeInputsError && routeInputsData) {
        console.log(`[Route Plans] Found ${routeInputsData.length} plan inputs for ${orderIds.length} orders`);
        
        // Process all inputs - each order_id gets its route plan info
        routeInputsData.forEach((input: any) => {
          const planData = input.receiving_route_plans;
          const plan = Array.isArray(planData) ? planData[0] : planData;
          
          // Only set if not already set and plan is in optimizing or later status
          if (!routePlansMap.has(input.order_id) && plan?.plan_code) {
            routePlansMap.set(input.order_id, {
              plan_code: plan.plan_code,
              trip_code: null, // Will be filled from stops if available
              trip_sequence: null
            });
          }
        });
        
        // Now fetch trip info from stops for orders that have been assigned to trips
        const { data: routeStopsData, error: routeStopsError } = await supabase
          .from('receiving_route_stops')
          .select(`
            order_id,
            trip_id,
            tags,
            receiving_route_trips (
              trip_code,
              trip_sequence
            )
          `)
          .in('order_id', orderIds)
          .not('order_id', 'is', null);

        if (!routeStopsError && routeStopsData) {
          console.log(`[Route Plans] Found ${routeStopsData.length} stops with trip info`);
          
          let updatedCount = 0;
          routeStopsData.forEach((stop: any) => {
            const tripData = Array.isArray(stop.receiving_route_trips)
              ? stop.receiving_route_trips[0]
              : stop.receiving_route_trips;
            
            // Get all order IDs for this stop (including consolidated orders)
            const stopOrderIds: number[] = [];
            
            // Add primary order_id
            if (stop.order_id) {
              stopOrderIds.push(stop.order_id);
            }
            
            // Add additional order_ids from tags if consolidated
            if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
              stop.tags.order_ids.forEach((orderId: number) => {
                if (orderId && !stopOrderIds.includes(orderId)) {
                  stopOrderIds.push(orderId);
                }
              });
            }
            
            // Update trip info for all orders in this stop
            stopOrderIds.forEach(orderId => {
              if (routePlansMap.has(orderId)) {
                const existing = routePlansMap.get(orderId);
                routePlansMap.set(orderId, {
                  ...existing,
                  trip_code: tripData?.trip_code || null,
                  trip_sequence: tripData?.trip_sequence || null
                });
                updatedCount++;
              }
            });
          });
          
          console.log(`[Route Plans] Updated ${updatedCount} orders with trip info`);
        } else if (routeStopsError) {
          console.error('Error fetching route stops:', routeStopsError);
        }
        
        console.log(`[Route Plans] Mapped ${routePlansMap.size} orders to route plans`);
      } else if (routeInputsError) {
        console.error('Error fetching route inputs:', routeInputsError);
      }
    }

    // Merge customer data and route plan data into orders
    const ordersWithCustomer = ordersData?.map(order => {
      const routePlan = routePlansMap.get(order.order_id);
      return {
        ...order,
        customer: customersMap.get(order.customer_id) || null,
        plan_code: routePlan?.plan_code || null,
        trip_code: routePlan?.trip_code || null,
        trip_sequence: routePlan?.trip_sequence || null
      };
    }) || [];

    // Debug: Log sample merged data
    console.log('[Route Plans] Sample merged order:', {
      order_id: ordersWithCustomer[0]?.order_id,
      order_no: ordersWithCustomer[0]?.order_no,
      plan_code: ordersWithCustomer[0]?.plan_code,
      trip_code: ordersWithCustomer[0]?.trip_code
    });
    console.log('[Route Plans] Orders with plan_code:', ordersWithCustomer.filter(o => o.plan_code).length);
    console.log('[Route Plans] Orders with trip_code:', ordersWithCustomer.filter(o => o.trip_code).length);

    return NextResponse.json({ data: ordersWithCustomer, error: null });
  } catch (error) {
    console.error('API Error in GET /api/orders/with-items:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

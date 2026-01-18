import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Published Plans API] Called at:', new Date().toISOString());
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // ✅ PAGINATION: เพิ่ม page parameter
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    // Get route plans with status 'approved' only
    // approved = อนุมัติแล้ว (ผู้จัดการอนุมัติใบว่าจ้างแล้ว - พร้อมสร้าง Picklist)
    const { data: plans, error, count } = await supabase
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
        settings,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `, { count: 'exact' })
      .eq('status', 'approved')
      .order('plan_date', { ascending: false })
      .order('plan_code', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching published plans:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Fetch trip_ids where orders are already picked/loaded/in_transit/delivered
    // Check directly from route stops and their order status
    const { data: stopsWithProcessedOrders } = await supabase
      .from('receiving_route_stops')
      .select('trip_id, order_id, tags, wms_orders(status)')
      .not('order_id', 'is', null);

    // Also get all stops to check tags.order_ids
    const { data: allStops } = await supabase
      .from('receiving_route_stops')
      .select('trip_id, tags');

    const tripIdsWithPicklist = new Set<number>();

    // Check stops with direct order_id
    (stopsWithProcessedOrders || []).forEach((stop: any) => {
      if (stop.wms_orders && ['picked', 'loaded', 'in_transit', 'delivered'].includes(stop.wms_orders.status)) {
        tripIdsWithPicklist.add(stop.trip_id);
      }
    });

    // Check stops with order_ids in tags
    if (allStops) {
      const orderIdsToCheck = new Set<number>();
      const tripOrderMap = new Map<number, number>(); // order_id -> trip_id

      allStops.forEach((stop: any) => {
        if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
          stop.tags.order_ids.forEach((orderId: number) => {
            orderIdsToCheck.add(orderId);
            tripOrderMap.set(orderId, stop.trip_id);
          });
        }
      });

      if (orderIdsToCheck.size > 0) {
        const { data: ordersInTags } = await supabase
          .from('wms_orders')
          .select('order_id, status')
          .in('order_id', Array.from(orderIdsToCheck))
          .in('status', ['picked', 'loaded', 'in_transit', 'delivered']);

        (ordersInTags || []).forEach((order: any) => {
          const tripId = tripOrderMap.get(order.order_id);
          if (tripId) {
            tripIdsWithPicklist.add(tripId);
          }
        });
      }
    }

    console.log('🚫 Filtered out trip IDs (picked/loaded/in_transit/delivered):', Array.from(tripIdsWithPicklist));

    // For each plan, fetch trips with their stops and orders
    const plansWithTrips = await Promise.all(
      (plans || []).map(async (plan) => {
        // Fetch trips for this plan
        const { data: trips, error: tripsError } = await supabase
          .from('receiving_route_trips')
          .select('trip_id, trip_sequence, daily_trip_number, vehicle_id, driver_id, shipping_cost, total_distance_km, total_weight_kg, notes, pricing_mode, base_price, helper_fee, extra_stop_fee, supplier_id')
          .eq('plan_id', plan.plan_id)
          .order('trip_sequence', { ascending: true });

        if (tripsError) {
          console.error('Error fetching trips:', tripsError);
          return { ...plan, trips: [] };
        }

        // ถ้าไม่มี trips ในตาราง แต่มี optimizedTrips ใน settings ให้สร้าง trips จาก optimizedTrips
        if ((!trips || trips.length === 0) && plan.settings?.optimizedTrips) {
          console.log(`⚠️ Plan ${plan.plan_code} has no trips in database, creating from optimizedTrips`);
          
          // สร้าง trips จาก optimizedTrips และ insert เข้าฐานข้อมูล
          const optimizedTrips = plan.settings.optimizedTrips;
          const planDate = new Date(plan.plan_date).toISOString().split('T')[0];
          
          // ดึง daily_trip_number ถัดไป
          const { data: maxDailyNumber } = await supabase
            .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
          
          const nextDailyNumber = maxDailyNumber || 1;
          
          const tripsToInsert = optimizedTrips.map((trip: any, index: number) => {
            const vehicleCapacity = plan.settings?.vehicleCapacityKg || 1000;
            const capacityUtil = vehicleCapacity > 0 ? ((trip.totalWeight || 0) / vehicleCapacity) * 100 : 0;

            return {
              plan_id: plan.plan_id,
              trip_sequence: index + 1,
              daily_trip_number: nextDailyNumber + index,
              trip_code: `TRIP-${String(index + 1).padStart(3, '0')}`,
              trip_status: 'planned',
              warehouse_id: plan.warehouse_id,
              total_distance_km: trip.totalDistance || 0,
              total_drive_minutes: Math.round(trip.totalDriveTime || 0),
              total_service_minutes: Math.round(trip.totalServiceTime || 0),
              total_stops: trip.stops?.length || 0,
              total_weight_kg: trip.totalWeight || 0,
              total_volume_cbm: trip.totalVolume || 0,
              total_pallets: trip.totalPallets || 0,
              capacity_utilization: Math.round(capacityUtil),
              fuel_cost_estimate: trip.totalCost || 0,
              shipping_cost: null,
              base_price: trip.basePrice || null,
              helper_fee: trip.helperFee || null,
              extra_stop_fee: trip.extraStopFee || null,
              is_overweight: trip.isOverweight || false,
              notes: trip.zoneName ? `โซน: ${trip.zoneName}` : null
            };
          });

          const { data: insertedTrips, error: insertError } = await supabase
            .from('receiving_route_trips')
            .insert(tripsToInsert)
            .select();

          if (insertError) {
            console.error('Error inserting trips from optimizedTrips:', insertError);
            return { ...plan, trips: [] };
          }

          // Insert stops for each trip
          for (let i = 0; i < optimizedTrips.length; i++) {
            const optimizedTrip = optimizedTrips[i];
            const insertedTrip = insertedTrips?.[i];

            if (!insertedTrip || !optimizedTrip.stops) continue;

            const stopsToInsert = optimizedTrip.stops.map((stop: any, stopIndex: number) => {
              const orderIds = stop.orderIds || (stop.orderId ? [stop.orderId] : []);
              const inputIds = stop.inputIds || (stop.id ? [stop.id] : []);

              return {
                trip_id: insertedTrip.trip_id,
                plan_id: plan.plan_id,
                sequence_no: stopIndex + 1,
                input_id: stop.id,
                stop_type: 'pickup',
                status: 'pending',
                stop_name: stop.stopName,
                address: stop.address,
                latitude: stop.latitude,
                longitude: stop.longitude,
                load_weight_kg: stop.weight || 0,
                load_volume_cbm: stop.volume || 0,
                load_pallets: stop.pallets || 0,
                service_duration_minutes: stop.serviceTime || 0,
                order_id: orderIds.length === 1 ? orderIds[0] : null,
                tags: {
                  order_ids: orderIds,
                  input_ids: inputIds,
                  order_count: stop.orderCount || orderIds.length || 1
                }
              };
            });

            const { error: stopsError } = await supabase
              .from('receiving_route_stops')
              .insert(stopsToInsert);

            if (stopsError) {
              console.error('Error inserting stops:', stopsError);
            }
          }

          console.log(`✅ Created ${insertedTrips?.length || 0} trips from optimizedTrips for plan ${plan.plan_code}`);

          // ใช้ trips ที่เพิ่ง insert
          const availableTrips = (insertedTrips || []).filter(
            (trip: any) => !tripIdsWithPicklist.has(trip.trip_id)
          );

          // Fetch stops with orders for newly created trips
          const tripsWithStops = await Promise.all(
            availableTrips.map(async (trip: any) => {
              const { data: stops } = await supabase
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

              // Collect all order IDs from stops
              const orderIds = new Set<number>();
              (stops || []).forEach((stop: any) => {
                if (stop.order_id) orderIds.add(stop.order_id);
                if (stop.tags?.order_ids) {
                  stop.tags.order_ids.forEach((id: number) => orderIds.add(id));
                }
              });

              // Fetch order details
              let orders: any[] = [];
              let orderItemsMap: Record<number, number> = {};

              if (orderIds.size > 0) {
                const { data: ordersData } = await supabase
                  .from('wms_orders')
                  .select('order_id, order_no, customer_id, shop_name, province, total_weight')
                  .in('order_id', Array.from(orderIds));

                if (ordersData) {
                  orders = ordersData;
                }

                const { data: orderItemsData } = await supabase
                  .from('wms_order_items')
                  .select('order_id, order_qty')
                  .in('order_id', Array.from(orderIds));

                if (orderItemsData) {
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
              const stopsWithOrders = (stops || []).map((stop: any) => {
                const stopOrderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
                const stopOrders = orders.filter((o) => stopOrderIds.includes(o.order_id));

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

          return { ...plan, trips: tripsWithStops };
        }

        // Filter out trips that already have picklists
        const availableTrips = (trips || []).filter(
          trip => !tripIdsWithPicklist.has(trip.trip_id)
        );

        // For each trip, fetch stops with orders
        const tripsWithStops = await Promise.all(
          availableTrips.map(async (trip) => {
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
                .select('order_id, order_no, customer_id, shop_name, province, total_weight')
                .in('order_id', Array.from(orderIds));

              if (!ordersError && ordersData) {
                orders = ordersData;
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

        return { ...plan, trips: tripsWithStops };
      })
    );

    // Filter out plans that have no available trips (all trips already have picklists)
    // Also filter out plans where all trips are empty (no stops or no orders)
    const plansWithAvailableTrips = plansWithTrips.filter(plan => {
      if (!plan.trips || plan.trips.length === 0) return false;
      
      // Check if at least one trip has stops with orders
      const hasValidTrips = plan.trips.some(trip => {
        if (!trip.stops || trip.stops.length === 0) return false;
        
        // Check if any stop has orders
        return trip.stops.some(stop => 
          stop.orders && stop.orders.length > 0
        );
      });
      
      return hasValidTrips;
    });

    // ✅ PAGINATION: Return with pagination metadata
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({ 
      data: plansWithAvailableTrips || [], 
      error: null,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching published plans:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select(`
        *,
        warehouse:master_warehouse!fk_receiving_route_plans_warehouse (
          warehouse_id,
          warehouse_name
        )
      `)
      .eq('plan_id', planId)
      .single();

    if (planError) {
      return NextResponse.json(
        { data: null, error: planError.message },
        { status: 500 }
      );
    }

    // Fetch trips first with picklist and loadlist info
    // Note: extra_delivery_stops is a JSONB column that stores special delivery stops without orders
    const { data: trips, error: tripsError } = await supabase
      .from('receiving_route_trips')
      .select(`
        *,
        supplier:master_supplier!fk_receiving_route_trips_supplier (
          supplier_id,
          supplier_name,
          supplier_code
        ),
        picklists (
          loading_door_number,
          wms_loadlist_picklists (
            loadlist:loadlists (
              loading_queue_number
            )
          )
        )
      `)
      .eq('plan_id', planId)
      .order('trip_sequence', { ascending: true });

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      return NextResponse.json(
        { data: null, error: tripsError.message },
        { status: 500 }
      );
    }

    // Fetch all stops for this plan's trips
    const tripIds = trips?.map(t => t.trip_id) || [];
    let allStops: any[] = [];

    if (tripIds.length > 0) {
      const { data: stops, error: stopsError } = await supabase
        .from('receiving_route_stops')
        .select(`
          *,
          order:wms_orders!fk_receiving_route_stops_order (
            order_id,
            order_no,
            customer_id,
            total_weight,
            order_date,
            delivery_date,
            notes
          )
        `)
        .in('trip_id', tripIds)
        .order('sequence_no', { ascending: true });

      if (stopsError) {
        console.error('Error fetching stops:', stopsError);
      } else {
        // Now fetch all orders and inputs for consolidated stops
        // Each stop may have multiple order IDs in tags.order_ids
        const allOrderIds = new Set<number>();
        const allInputIds = new Set<number>();

        for (const stop of stops || []) {
          // Get order IDs from tags
          const orderIds = stop.tags?.order_ids || [];
          orderIds.forEach((id: number) => allOrderIds.add(id));

          // Get input IDs from tags
          const inputIds = stop.tags?.input_ids || [];
          inputIds.forEach((id: number) => allInputIds.add(id));

          // Also include primary IDs if exist
          if (stop.order_id) {
            allOrderIds.add(stop.order_id);
          }
          if (stop.input_id) {
            allInputIds.add(stop.input_id);
          }
        }

        // Fetch all orders in one query
        let ordersMap: Record<number, any> = {};
        if (allOrderIds.size > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('wms_orders')
            .select('order_id, order_no, customer_id, shop_name, province, total_weight, order_date, delivery_date, notes, text_field_long_1')
            .in('order_id', Array.from(allOrderIds));

          if (!ordersError && ordersData) {
            ordersMap = ordersData.reduce((acc: any, order: any) => {
              acc[order.order_id] = order;
              return acc;
            }, {});
          }
        }

        // Fetch order items to get total quantity for each order
        let orderItemsMap: Record<number, number> = {};
        let orderItemsDetailMap: Record<number, any[]> = {};
        if (allOrderIds.size > 0) {
          const { data: orderItemsData, error: orderItemsError } = await supabase
            .from('wms_order_items')
            .select('order_id, order_item_id, sku_id, sku_name, order_qty, order_weight')
            .in('order_id', Array.from(allOrderIds));

          if (!orderItemsError && orderItemsData) {
            // Sum quantities by order_id and store details
            orderItemsData.forEach((item: any) => {
              // Sum quantities
              if (!orderItemsMap[item.order_id]) {
                orderItemsMap[item.order_id] = 0;
              }
              orderItemsMap[item.order_id] += item.order_qty || 0;
              
              // Store item details
              if (!orderItemsDetailMap[item.order_id]) {
                orderItemsDetailMap[item.order_id] = [];
              }
              orderItemsDetailMap[item.order_id].push({
                order_item_id: item.order_item_id,
                sku_id: item.sku_id,
                sku_name: item.sku_name,
                order_qty: Number(item.order_qty) || 0,
                order_weight: Number(item.order_weight) || 0
              });
            });

            console.log('📦 Order items map created:', {
              orderItemsMapSize: Object.keys(orderItemsMap).length,
              orderItemsDetailMapSize: Object.keys(orderItemsDetailMap).length,
              sampleOrderId: Object.keys(orderItemsMap)[0],
              sampleQty: orderItemsMap[Object.keys(orderItemsMap)[0]],
              sampleItemsCount: orderItemsDetailMap[Number(Object.keys(orderItemsDetailMap)[0])]?.length || 0,
              allOrderIds: Array.from(allOrderIds).slice(0, 10),
              allQuantities: Object.entries(orderItemsMap).slice(0, 5)
            });
          } else {
            console.warn('⚠️ No order items data or error occurred:', { orderItemsError, dataLength: orderItemsData?.length });
          }
        }

        // Fetch all inputs to get actual allocated weights
        let inputsMap: Record<number, any> = {};
        if (allInputIds.size > 0) {
          const { data: inputsData, error: inputsError } = await supabase
            .from('receiving_route_plan_inputs')
            .select('input_id, order_id, demand_weight_kg, demand_volume_cbm, demand_units, demand_pallets')
            .in('input_id', Array.from(allInputIds));

          if (!inputsError && inputsData) {
            inputsMap = inputsData.reduce((acc: any, input: any) => {
              acc[input.input_id] = input;
              return acc;
            }, {});
          }
        }

        // Fetch allocated items from receiving_route_stop_items for split tracking
        const stopIds = (stops || []).map((s: any) => s.stop_id);
        let stopItemsMap: Record<number, any[]> = {};
        if (stopIds.length > 0) {
          const { data: stopItemsData, error: stopItemsError } = await supabase
            .from('receiving_route_stop_items')
            .select('*')
            .in('stop_id', stopIds);

          if (!stopItemsError && stopItemsData && stopItemsData.length > 0) {
            // Group by stop_id
            stopItemsData.forEach((item: any) => {
              if (!stopItemsMap[item.stop_id]) {
                stopItemsMap[item.stop_id] = [];
              }
              stopItemsMap[item.stop_id].push({
                order_item_id: item.order_item_id,
                order_id: item.order_id, // Include order_id for filtering
                sku_id: item.sku_id,
                sku_name: item.sku_name,
                order_qty: Number(item.allocated_quantity) || 0,
                order_weight: Number(item.allocated_weight_kg) || 0
              });
            });
            console.log('📦 Stop items map created from receiving_route_stop_items:', {
              stopItemsMapSize: Object.keys(stopItemsMap).length,
              sampleStopId: Object.keys(stopItemsMap)[0],
              sampleItemsCount: stopItemsMap[Number(Object.keys(stopItemsMap)[0])]?.length || 0
            });
          }
        }

        // Map stops with their orders
        allStops = (stops || []).map((stop: any) => {
          const orderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
          const inputIds = stop.tags?.input_ids || (stop.input_id ? [stop.input_id] : []);

          // Check if this stop has specific item allocations
          const hasStopItems = stopItemsMap[stop.stop_id] && stopItemsMap[stop.stop_id].length > 0;
          const splitItemIds = stop.tags?.split_item_ids;
          const hasSplitItems = splitItemIds && Array.isArray(splitItemIds) && splitItemIds.length > 0;

          // Debug: log order lookup
          console.log('🔍 Stop order lookup:', {
            stop_id: stop.stop_id,
            orderIds,
            hasStopItems,
            hasSplitItems,
            ordersMapKeys: Object.keys(ordersMap).slice(0, 5),
            orderItemsDetailMapKeys: Object.keys(orderItemsDetailMap).slice(0, 5),
            orderItemsDetailMapSample: orderIds.length > 0 ? {
              firstOrderId: orderIds[0],
              hasItems: !!orderItemsDetailMap[orderIds[0]],
              itemsCount: orderItemsDetailMap[orderIds[0]]?.length || 0
            } : null
          });

          // Build orders array with weights from inputs
          const orders = orderIds.map((orderId: number, index: number) => {
            const order = ordersMap[orderId];
            if (!order) return null;

            // Find the corresponding input for this order to get actual allocated weight
            const inputId = inputIds[index];
            const input = inputId ? inputsMap[inputId] : null;

            // Determine which items to use for this stop
            let itemsForStop: any[] = [];
            let totalQty = 0;
            let allocatedWeight = 0;

            if (hasStopItems) {
              // Use items from receiving_route_stop_items (split tracking)
              // IMPORTANT: Filter by order_id to get only items for THIS order
              const allStopItems = stopItemsMap[stop.stop_id] || [];
              
              // Filter stop items that belong to this order by order_id (primary method)
              itemsForStop = allStopItems.filter((item: any) => item.order_id === orderId);
              
              // If no items found by order_id, try matching by order_item_id
              if (itemsForStop.length === 0) {
                const orderItemIds = (orderItemsDetailMap[orderId] || []).map((item: any) => item.order_item_id);
                itemsForStop = allStopItems.filter((item: any) => orderItemIds.includes(item.order_item_id));
              }
              
              totalQty = itemsForStop.reduce((sum, item) => sum + (item.order_qty || 0), 0);
              allocatedWeight = itemsForStop.reduce((sum, item) => sum + (item.order_weight || 0), 0);
              
              // If still no items found, fall back to order items from wms_order_items
              if (itemsForStop.length === 0) {
                itemsForStop = orderItemsDetailMap[orderId] || [];
                totalQty = orderItemsMap[orderId] || 0;
                allocatedWeight = input?.demand_weight_kg != null && input.demand_weight_kg > 0
                  ? Number(input.demand_weight_kg)
                  : (order.total_weight != null && order.total_weight > 0
                    ? Number(order.total_weight)
                    : 0);
              }
            } else if (hasSplitItems) {
              // This stop was created from a split - only show split items
              const allItems = orderItemsDetailMap[order.order_id] || [];
              itemsForStop = allItems.filter((item: any) => splitItemIds.includes(item.order_item_id));
              totalQty = itemsForStop.reduce((sum, item) => sum + (item.order_qty || 0), 0);
              // Calculate weight from split items
              allocatedWeight = itemsForStop.reduce((sum, item) => sum + (item.order_weight || 0), 0);
            } else {
              // No split tracking - use all items from order
              itemsForStop = orderItemsDetailMap[order.order_id] || [];
              totalQty = orderItemsMap[order.order_id] || 0;
              // Use weight from input if available, otherwise use order total weight
              allocatedWeight = input?.demand_weight_kg != null && input.demand_weight_kg > 0
                ? Number(input.demand_weight_kg)
                : (order.total_weight != null && order.total_weight > 0
                  ? Number(order.total_weight)
                  : 0);
            }

            // Debug log for first order
            if (index === 0 && stop.stop_id === allStops[0]?.stop_id) {
              console.log('🔍 Order quantity debug:', {
                order_id: order.order_id,
                order_no: order.order_no,
                totalQty,
                allocatedWeight,
                hasStopItems,
                hasSplitItems,
                itemsForStopCount: itemsForStop.length,
                orderItemsMapHasKey: orderItemsMap.hasOwnProperty(order.order_id),
                orderItemsMapValue: orderItemsMap[order.order_id],
                stopLoadWeightKg: stop.load_weight_kg
              });
            }

            return {
              order_id: order.order_id,
              order_no: order.order_no,
              customer_id: order.customer_id,
              customer_name: stop.stop_name,
              shop_name: order.shop_name || stop.stop_name,
              province: order.province || null,
              allocated_weight_kg: allocatedWeight,
              total_order_weight_kg: order.total_weight,
              total_qty: totalQty,
              note: order.notes || null,
              text_field_long_1: order.text_field_long_1 || null,
              items: itemsForStop,
              is_split: hasStopItems || hasSplitItems
            };
          }).filter((order: any) => order != null);

          return {
            ...stop,
            order_no: orders[0]?.order_no || stop.order?.order_no || null,
            order_id: stop.order_id || orders[0]?.order_id || null,
            order_weight: stop.load_weight_kg || 0,
            orders: orders.length > 0 ? orders : null, // Array of orders for this stop
            order_data: stop.order || null
          };
        });

        console.log('✅ Stops with consolidated order info:', {
          stopsCount: allStops.length,
          ordersMapSize: Object.keys(ordersMap).length,
          inputsMapSize: Object.keys(inputsMap).length,
          orderItemsDetailMapSize: Object.keys(orderItemsDetailMap).length,
          sampleOrderItems: Object.entries(orderItemsDetailMap).slice(0, 2).map(([k, v]) => ({
            order_id: k,
            items_count: (v as any[]).length,
            first_item: (v as any[])[0]
          })),
          firstStop: allStops[0] ? {
            stop_id: allStops[0].stop_id,
            stop_name: allStops[0].stop_name,
            order_id: allStops[0].order_id,
            order_no: allStops[0].order_no,
            orders_count: allStops[0].orders?.length || 0,
            is_consolidated: (allStops[0].orders?.length || 0) > 1,
            orders_detail: allStops[0].orders?.map((o: any) => ({
              order_id: o.order_id,
              order_no: o.order_no,
              weight: o.allocated_weight_kg,
              items_count: o.items?.length || 0,
              first_item: o.items?.[0]
            })),
            tags: allStops[0].tags
          } : null
        });
      }
    }

    // Group stops by trip_id
    const stopsByTrip = allStops.reduce((acc: any, stop: any) => {
      if (!acc[stop.trip_id]) {
        acc[stop.trip_id] = [];
      }
      acc[stop.trip_id].push(stop);
      return acc;
    }, {});

    // Combine trips with their stops and extract loading door/queue info
    const tripsWithSortedStops = trips?.map(trip => {
      // Extract loading_door_number from picklists (first picklist)
      const loadingDoorNumber = trip.picklists?.[0]?.loading_door_number || null;
      
      // Extract loading_queue_number from loadlist (first loadlist)
      const loadingQueueNumber = trip.picklists?.[0]?.wms_loadlist_picklists?.[0]?.loadlist?.loading_queue_number || null;
      
      // Extract supplier info
      const supplierInfo = trip.supplier as any;
      
      return {
        ...trip,
        loading_door_number: loadingDoorNumber,
        loading_queue_number: loadingQueueNumber,
        supplier_name: supplierInfo?.supplier_name || null,
        supplier_code: supplierInfo?.supplier_code || null,
        stops: stopsByTrip[trip.trip_id] || []
      };
    }) || [];

    console.log('Raw trips data:', {
      tripsCount: trips?.length || 0,
      stopsCount: allStops.length,
      firstTrip: tripsWithSortedStops[0] ? {
        trip_id: tripsWithSortedStops[0].trip_id,
        stopsCount: tripsWithSortedStops[0].stops?.length || 0
      } : null
    });

    // If no trips in database, try to get from plan.settings.optimizedTrips (fallback mode)
    let finalTrips = tripsWithSortedStops;
    
    if (tripsWithSortedStops.length === 0 && plan.settings?.optimizedTrips) {
      console.log('⚠️ No trips in database, using optimizedTrips from settings');
      
      // Collect all order IDs from optimizedTrips
      const allOrderIds = plan.settings.optimizedTrips
        .flatMap((trip: any) => trip.stops || [])
        .flatMap((stop: any) => {
          // Handle both orderId (single) and orderIds (array)
          if (Array.isArray(stop.orderIds)) {
            return stop.orderIds;
          } else if (stop.orderId != null) {
            return [stop.orderId];
          }
          return [];
        })
        .filter((id: any) => id != null);
      
      console.log('📋 Order IDs from optimizedTrips:', {
        allOrderIds,
        count: allOrderIds.length,
        sample: plan.settings.optimizedTrips[0]?.stops?.[0]
      });
      
      // Fetch order details if we have order IDs
      let ordersMap: Record<number, any> = {};
      let orderItemsMap: Record<number, number> = {};
      let orderItemsDetailMap: Record<number, any[]> = {};

      if (allOrderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
          .from('wms_orders')
          .select(`
            order_id,
            order_no,
            customer_id,
            shop_name,
            province,
            total_weight,
            notes,
            text_field_long_1
          `)
          .in('order_id', allOrderIds);

        console.log('📦 Orders query result:', {
          ordersCount: orders?.length || 0,
          error: ordersError,
          firstOrder: orders?.[0]
        });

        if (orders) {
          ordersMap = orders.reduce((acc: Record<number, any>, order: any) => {
            acc[order.order_id] = order;
            return acc;
          }, {});
        }

        // Fetch order items to get total quantity and details for each order (FALLBACK MODE)
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('wms_order_items')
          .select('order_id, order_item_id, sku_id, sku_name, order_qty, order_weight')
          .in('order_id', allOrderIds);

        console.log('📦 Order items query result:', {
          itemsCount: orderItemsData?.length || 0,
          error: orderItemsError,
          firstItem: orderItemsData?.[0]
        });

        if (!orderItemsError && orderItemsData) {
          // Sum quantities by order_id and store details
          orderItemsData.forEach((item: any) => {
            // Sum quantities
            if (!orderItemsMap[item.order_id]) {
              orderItemsMap[item.order_id] = 0;
            }
            orderItemsMap[item.order_id] += item.order_qty || 0;
            
            // Store item details
            if (!orderItemsDetailMap[item.order_id]) {
              orderItemsDetailMap[item.order_id] = [];
            }
            orderItemsDetailMap[item.order_id].push({
              order_item_id: item.order_item_id,
              sku_id: item.sku_id,
              sku_name: item.sku_name,
              order_qty: item.order_qty,
              order_weight: item.order_weight
            });
          });
        }
      }
      
      finalTrips = plan.settings.optimizedTrips.map((trip: any, index: number) => ({
        trip_id: `fallback-${index + 1}`,
        trip_sequence: index + 1,
        trip_code: `TRIP-${String(index + 1).padStart(3, '0')}`,
        plan_id: planId,
        total_distance_km: trip.totalDistance || 0,
        total_drive_minutes: trip.totalDriveTime || 0,
        total_service_minutes: trip.totalServiceTime || 0,
        total_weight_kg: trip.totalWeight || 0,
        fuel_cost_estimate: trip.totalCost || 0,
        notes: trip.zoneName || null,
        stops: (trip.stops || []).map((stop: any, stopIndex: number) => {
          // Handle both orderId (single) and orderIds (array)
          const orderIds = Array.isArray(stop.orderIds) ? stop.orderIds : (stop.orderId ? [stop.orderId] : []);
          const primaryOrderId = orderIds[0] || null;
          const orderInfo = primaryOrderId ? ordersMap[primaryOrderId] : null;
          
          // Build orders array for consolidated stops
          const orders = orderIds.map((oid: number) => {
            const order = ordersMap[oid];
            if (!order) return null;

            // Use actual order weight if available, otherwise split evenly
            const orderWeight = order.total_weight != null && Number.isFinite(Number(order.total_weight))
              ? Number(order.total_weight)
              : stop.weight / orderIds.length;

            // Get quantity from order items map
            const totalQty = orderItemsMap[order.order_id] || 0;

            return {
              order_id: order.order_id,
              order_no: order.order_no,
              customer_id: order.customer_id,
              customer_name: stop.stopName,
              shop_name: order.shop_name || stop.stopName,
              province: order.province || null,
              allocated_weight_kg: orderWeight,
              total_order_weight_kg: orderWeight,
              total_qty: totalQty,
              note: order.notes || null,
              text_field_long_1: order.text_field_long_1 || null,
              items: orderItemsDetailMap[order.order_id] || []
            };
          }).filter((o: any) => o != null);
          
          return {
            stop_id: `fallback-stop-${index + 1}-${stopIndex + 1}`,
            trip_id: `fallback-${index + 1}`,
            sequence_no: stopIndex + 1,
            stop_name: stop.stopName || stop.address || `จุดที่ ${stopIndex + 1}`,
            address: stop.address || null,
            latitude: stop.latitude || null,
            longitude: stop.longitude || null,
            load_weight_kg: stop.weight || 0,
            service_duration_minutes: stop.serviceTime || 0,
            planned_arrival_at: stop.estimatedArrival || null,
            planned_departure_at: stop.estimatedDeparture || null,
            order_id: primaryOrderId,
            order_no: orderInfo?.order_no || null,
            customer_name: null,
            orders: orders.length > 0 ? orders : null
          };
        })
      }));
      
      console.log('✅ Converted optimizedTrips to trips format:', {
        tripsCount: finalTrips.length,
        ordersMapSize: Object.keys(ordersMap).length,
        firstTrip: finalTrips[0] ? {
          trip_id: finalTrips[0].trip_id,
          stopsCount: finalTrips[0].stops?.length,
          firstStop: finalTrips[0].stops?.[0] ? {
            stop_id: finalTrips[0].stops[0].stop_id,
            stop_name: finalTrips[0].stops[0].stop_name,
            order_id: finalTrips[0].stops[0].order_id,
            order_no: finalTrips[0].stops[0].order_no,
            customer_name: finalTrips[0].stops[0].customer_name
          } : null
        } : null
      });
    }

    console.log('Editor data:', {
      planId,
      tripsCount: finalTrips.length,
      source: tripsWithSortedStops.length > 0 ? 'database' : 'settings',
      warehouse: plan.warehouse,
      firstTrip: finalTrips[0] ? {
        trip_id: finalTrips[0].trip_id,
        stopsCount: finalTrips[0].stops?.length,
        firstStop: finalTrips[0].stops?.[0] ? {
          stop_id: finalTrips[0].stops[0].stop_id,
          stop_name: finalTrips[0].stops[0].stop_name,
          latitude: finalTrips[0].stops[0].latitude,
          longitude: finalTrips[0].stops[0].longitude,
          sequence_no: finalTrips[0].stops[0].sequence_no,
          orders_count: finalTrips[0].stops[0].orders?.length || 0,
          first_order_items: finalTrips[0].stops[0].orders?.[0]?.items?.length || 0,
          first_order_items_sample: finalTrips[0].stops[0].orders?.[0]?.items?.[0] || null
        } : null
      } : null
    });

    // Final verification log
    console.log('🚀 Final API response verification:', {
      tripsCount: finalTrips.length,
      allOrdersWithItems: finalTrips.flatMap((t: any) => 
        (t.stops || []).flatMap((s: any) => 
          (s.orders || []).map((o: any) => ({
            order_id: o.order_id,
            order_no: o.order_no,
            items_count: o.items?.length || 0
          }))
        )
      )
    });

    return NextResponse.json({
      data: {
        plan,
        trips: finalTrips,
        warehouse: plan.warehouse
      },
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching route plan editor data:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

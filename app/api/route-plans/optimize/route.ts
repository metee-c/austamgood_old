import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// VRP Optimization Algorithms
import {
  clusterDeliveriesIntoZones,
  insertionHeuristic,
  clarkeWrightSavings,
  nearestNeighbor,
  localSearch2Opt,
  consolidateRoutes,
  calculateRouteCosts,
  reorderStopsByMethod,
  enforceVehicleLimit
} from '@/lib/vrp/algorithms';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // 1. Fetch plan and settings
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('*, warehouse:master_warehouse!fk_receiving_route_plans_warehouse(*)')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // 2. Fetch inputs first
    const { data: inputs, error: inputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .select('*')
      .eq('plan_id', planId)
      .eq('is_active', true);

    if (inputsError) {
      console.error('Error fetching inputs:', inputsError);
      return NextResponse.json(
        { error: 'Error fetching inputs: ' + inputsError.message },
        { status: 500 }
      );
    }

    if (!inputs || inputs.length === 0) {
      return NextResponse.json(
        { error: 'No active inputs found for this plan' },
        { status: 400 }
      );
    }

    // 3. Get all unique order IDs
    const orderIds = [...new Set(inputs.map(input => input.order_id).filter(Boolean))];

    console.log('📦 Fetching order data for IDs:', orderIds);

    // 4. Fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, total_qty, total_pack_all')
      .in('order_id', orderIds);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Error fetching orders: ' + ordersError.message },
        { status: 500 }
      );
    }

    console.log('✅ Fetched orders:', { count: orders?.length || 0 });

    // 5. Fetch all order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('wms_order_items')
      .select('order_item_id, order_id, sku_id, order_qty, pack_all')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json(
        { error: 'Error fetching order items: ' + itemsError.message },
        { status: 500 }
      );
    }

    console.log('✅ Fetched order items:', { count: orderItems?.length || 0 });

    // 6. Get unique SKU IDs
    const skuIds = [...new Set(orderItems?.map(item => item.sku_id).filter(Boolean) || [])];

    // 7. Fetch all SKU data
    const { data: skus, error: skusError } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, sku_description, qty_per_pack, qty_per_pallet, dimension_length_cm, dimension_width_cm, dimension_height_cm')
      .in('sku_id', skuIds);

    if (skusError) {
      console.error('Error fetching SKUs:', skusError);
      return NextResponse.json(
        { error: 'Error fetching SKUs: ' + skusError.message },
        { status: 500 }
      );
    }

    console.log('✅ Fetched SKUs:', { count: skus?.length || 0 });

    // 8. Build data structure: SKU map -> Item map -> Order map
    const skuMap = new Map(skus?.map(sku => [sku.sku_id, sku]) || []);

    // Attach SKU data to items
    const itemsWithSkus = orderItems?.map(item => ({
      ...item,
      sku: skuMap.get(item.sku_id) || null
    })) || [];

    // Group items by order_id
    const itemsByOrderId = new Map<number, any[]>();
    for (const item of itemsWithSkus) {
      if (!itemsByOrderId.has(item.order_id)) {
        itemsByOrderId.set(item.order_id, []);
      }
      itemsByOrderId.get(item.order_id)!.push(item);
    }

    // Attach items to orders
    const ordersWithItems = orders?.map(order => ({
      ...order,
      items: itemsByOrderId.get(order.order_id) || []
    })) || [];

    // 9. Create a map of orders by order_id for easy lookup
    const ordersMap = new Map(ordersWithItems.map(order => [order.order_id, order]));

    // 10. Attach order data to each input
    const inputsWithOrders = inputs.map(input => ({
      ...input,
      order: ordersMap.get(input.order_id) || null
    }));

    const settings = plan.settings || {};
    const warehouseLocation = {
      latitude: settings.warehouseLat || plan.warehouse?.latitude || 13.5838323,
      longitude: settings.warehouseLng || plan.warehouse?.longitude || 100.7576916
    };

    // Helper function to calculate volume and pallet from order items
    function calculateVolumeAndPallets(input: any): { volume: number; pallets: number; missingDimensions: string[] } {
      const order = input.order;
      let totalVolume = 0;
      let totalPallets = 0;
      const missingDimensions: string[] = [];

      if (order && order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const sku = item.sku;
          const packQty = item.pack_all || 0; // จำนวนแพ็ค
          const pieceQty = item.order_qty || 0; // จำนวนชิ้น

          if (!sku) continue;

          // Calculate pallets from packs
          // วิธีที่ 1: ถ้ามี qty_per_pallet ใช้แพ็คหาร
          if (sku.qty_per_pallet && sku.qty_per_pallet > 0 && sku.qty_per_pack && sku.qty_per_pack > 0) {
            // คำนวณจำนวนแพ็คต่อพาเลท
            const packsPerPallet = sku.qty_per_pallet / sku.qty_per_pack;
            if (packsPerPallet > 0) {
              totalPallets += packQty / packsPerPallet;
            } else {
              // Fallback: ใช้ชิ้นหารด้วย qty_per_pallet
              totalPallets += pieceQty / sku.qty_per_pallet;
            }
          } else if (sku.qty_per_pallet && sku.qty_per_pallet > 0) {
            // ใช้ชิ้นหารด้วย qty_per_pallet โดยตรง
            totalPallets += pieceQty / sku.qty_per_pallet;
          } else {
            // Default: สมมติ 50 แพ็คต่อพาเลท
            totalPallets += packQty / 50;
          }

          // Calculate volume from dimensions
          if (sku.dimension_length_cm && sku.dimension_width_cm && sku.dimension_height_cm) {
            // คำนวณ volume ต่อแพ็ค: (L * W * H) in cm³ → convert to m³
            const volumePerPack = (sku.dimension_length_cm * sku.dimension_width_cm * sku.dimension_height_cm) / 1000000;
            totalVolume += volumePerPack * packQty;
          } else {
            // Missing dimension data
            missingDimensions.push(`${sku.sku_id} (${sku.sku_name || sku.sku_description || 'No description'})`);
            // Default: สมมติ 0.1 CBM ต่อแพ็ค
            totalVolume += 0.1 * packQty;
          }
        }
      } else {
        // Fallback: use total_pack_all if no items
        const totalPack = order?.total_pack_all || 0;
        totalPallets = totalPack / 50; // Default: 50 packs per pallet
        totalVolume = totalPack * 0.1; // Default: 0.1 CBM per pack
      }

      return {
        volume: totalVolume,
        pallets: totalPallets,
        missingDimensions
      };
    }

    // 7. Prepare deliveries data and consolidate orders by location
    // Group inputs by customer location (stopName + lat/lng combination)
    const locationGroups = new Map<string, any[]>();
    const allMissingDimensions = new Set<string>();

    for (const input of inputsWithOrders) {
      // Create a unique key for each location (using stop name and rounded coordinates)
      const latRounded = Math.round((input.latitude || 0) * 10000) / 10000;
      const lngRounded = Math.round((input.longitude || 0) * 10000) / 10000;
      const locationKey = `${input.stop_name}_${latRounded}_${lngRounded}`;

      if (!locationGroups.has(locationKey)) {
        locationGroups.set(locationKey, []);
      }
      locationGroups.get(locationKey)!.push(input);
    }

    // Convert grouped inputs to consolidated deliveries
    const deliveries = Array.from(locationGroups.values()).map((groupInputs: any[]) => {
      // Sum up weights and quantities from inputs
      const totalWeight = groupInputs.reduce((sum, inp) => sum + (inp.demand_weight_kg || 0), 0);
      
      // Calculate total pieces (not order count) from order.total_qty
      const totalPieces = groupInputs.reduce((sum, inp) => {
        const order = inp.order;
        const qty = order?.total_qty || 0;
        return sum + Number(qty);
      }, 0);

      // Calculate volume and pallets from SKU data
      let totalVolume = 0;
      let totalPallets = 0;

      for (const inp of groupInputs) {
        const calc = calculateVolumeAndPallets(inp);
        totalVolume += calc.volume;
        totalPallets += calc.pallets;

        // Track SKUs missing dimension data
        calc.missingDimensions.forEach(sku => allMissingDimensions.add(sku));
      }

      // Use the first input as representative for location details
      const representative = groupInputs[0];

      return {
        id: representative.input_id,
        orderIds: groupInputs.map((inp: any) => inp.order_id), // Store all order IDs
        inputIds: groupInputs.map((inp: any) => inp.input_id), // Store all input IDs
        stopName: representative.stop_name,
        address: representative.address,
        latitude: representative.latitude,
        longitude: representative.longitude,
        weight: totalWeight,
        volume: totalVolume,
        units: totalPieces, // จำนวนชิ้นสินค้าจริง (ไม่ใช่จำนวนออเดอร์)
        pallets: totalPallets,
        serviceTime: representative.service_duration_minutes || settings.serviceTime || 15,
        priority: Math.max(...groupInputs.map((inp: any) => inp.priority || 50)),
        timeWindowStart: representative.time_window_start,
        timeWindowEnd: representative.time_window_end,
        orderCount: groupInputs.length
      };
    });

    console.log(`Starting optimization for plan ${planId} with ${deliveries.length} stops (from ${inputsWithOrders.length} orders)`);

    // Log SKUs missing dimension data
    if (allMissingDimensions.size > 0) {
      console.warn('⚠️ WARNING: The following SKUs are missing dimension data (width, height, length):');
      console.warn(Array.from(allMissingDimensions).join('\n'));
      console.warn('Please update master_sku table with dimension data for accurate volume calculation');
    }

    // 4. Apply geographic clustering if enabled
    let zonedDeliveries: any = { 0: deliveries };
    
    if (settings.zoneMethod && settings.zoneMethod !== 'none') {
      const numZones = settings.numZones || Math.max(2, Math.ceil(deliveries.length / (settings.maxStoresPerZone || 10)));
      zonedDeliveries = clusterDeliveriesIntoZones(
        deliveries,
        settings.zoneMethod,
        numZones,
        settings.maxStoresPerZone || 10
      );
      console.log(`Clustered into ${Object.keys(zonedDeliveries).length} zones`);
    }

    // 5. Optimize routes for each zone
    let allTrips: any[] = [];
    let tripSequence = 1;

    for (const [zoneId, zoneDeliveries] of Object.entries(zonedDeliveries)) {
      if (!Array.isArray(zoneDeliveries) || zoneDeliveries.length === 0) continue;

      console.log(`Optimizing zone ${zoneId} with ${zoneDeliveries.length} deliveries`);

      // Choose algorithm based on settings
      let zoneTrips: any[] = [];
      const algorithm = settings.routingAlgorithm || 'insertion';

      switch (algorithm) {
        case 'savings':
          zoneTrips = clarkeWrightSavings(zoneDeliveries, warehouseLocation, settings);
          break;
        case 'nearest':
          zoneTrips = nearestNeighbor(zoneDeliveries, warehouseLocation, settings);
          break;
        case 'insertion':
        default:
          zoneTrips = insertionHeuristic(zoneDeliveries, warehouseLocation, settings);
          break;
      }

      // Apply local search optimization if enabled
      if (settings.localSearchMethod && settings.localSearchMethod !== 'none') {
        console.log(`Applying ${settings.localSearchMethod} optimization`);
        zoneTrips = localSearch2Opt(zoneTrips, warehouseLocation, settings);
      }

      // Add zone information and sequence
      zoneTrips = zoneTrips.map((trip: any) => ({
        ...trip,
        zoneId: parseInt(zoneId),
        zoneName: `โซน ${parseInt(zoneId) + 1}`,
        tripSequence: tripSequence++
      }));

      allTrips.push(...zoneTrips);
    }

    // 6. Consolidate routes if enabled
    if (settings.consolidationEnabled && allTrips.length > 1) {
      console.log('Consolidating routes...');
      allTrips = consolidateRoutes(allTrips, warehouseLocation, settings);
    }

    // 7. Reorder stops based on user-selected method
    if (settings.stopOrderingMethod && settings.stopOrderingMethod !== 'optimized') {
      console.log(`Reordering stops using method: ${settings.stopOrderingMethod}`);
      allTrips = reorderStopsByMethod(allTrips, warehouseLocation, settings.stopOrderingMethod);
    }

    // 8. Enforce vehicle limit if specified
    if (settings.maxVehicles > 0 && settings.enforceVehicleLimit) {
      console.log(`Enforcing vehicle limit: max ${settings.maxVehicles} vehicles`);
      allTrips = enforceVehicleLimit(allTrips, warehouseLocation, settings);
    }

    // 9. Calculate costs and metrics
    allTrips = calculateRouteCosts(allTrips, warehouseLocation, settings);

    // 10. Save trips to database
    try {
      // ดึงเลขคันสูงสุดของวันนี้เพื่อกำหนด daily_trip_number
      const planDate = new Date(plan.plan_date).toISOString().split('T')[0];
      const { data: maxDailyNumber } = await supabase
        .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
      
      let nextDailyNumber = maxDailyNumber || 1;

      const tripsToInsert = allTrips.map((trip: any, index: number) => {
        const vehicleCapacity = settings.vehicleCapacityKg || 1000;
        const capacityUtil = vehicleCapacity > 0 ? ((trip.totalWeight || 0) / vehicleCapacity) * 100 : 0;

        return {
          plan_id: planId,
          trip_sequence: index + 1,
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
          // ไม่บันทึกค่าขนส่งอัตโนมัติ - ให้ผู้ใช้กรอกเองผ่าน Modal "แก้ไขราคาค่าขนส่ง"
          shipping_cost: null,
          base_price: null,
          helper_fee: null,
          extra_stop_fee: null,
          is_overweight: trip.isOverweight || false,
          notes: trip.zoneName ? `โซน: ${trip.zoneName}` : null,
          daily_trip_number: nextDailyNumber + index // เลขคันที่ไม่ซ้ำกันทั้งวัน
        };
      });

      // Delete existing trips for this plan
      await supabase
        .from('receiving_route_trips')
        .delete()
        .eq('plan_id', planId);

      const { data: insertedTrips, error: tripsError } = await supabase
        .from('receiving_route_trips')
        .insert(tripsToInsert)
        .select();

      if (tripsError) {
        console.error('❌ ERROR: Could not save trips to database:', {
          message: tripsError.message,
          code: tripsError.code,
          details: tripsError.details,
          hint: tripsError.hint
        });
        console.log('⚠️ Trips data will be stored in plan settings instead');

        // Store trips data in plan settings as fallback
        await supabase
          .from('receiving_route_plans')
          .update({
            settings: {
              ...plan.settings,
              optimizedTrips: allTrips
            }
          })
          .eq('plan_id', planId);
      } else if (insertedTrips) {
        // 10. Save stops for each trip
        for (let i = 0; i < allTrips.length; i++) {
          const trip = allTrips[i];
          const insertedTrip = insertedTrips[i];

          const stopsToInsert = trip.stops.map((stop: any, stopIndex: number) => {
            // Handle consolidated stops (multiple orders to same location)
            const orderIds = stop.orderIds || (stop.orderId ? [stop.orderId] : []);
            const inputIds = stop.inputIds || (stop.id ? [stop.id] : []);
            const orderCount = stop.orderCount || orderIds.length || 1;

            return {
              trip_id: insertedTrip.trip_id,
              plan_id: planId,
              sequence_no: stopIndex + 1,
              input_id: stop.id, // Primary input ID
              stop_type: 'pickup',
              status: 'pending',
              stop_name: stop.stopName,
              address: stop.address,
              latitude: stop.latitude,
              longitude: stop.longitude,
              load_weight_kg: stop.weight,
              load_volume_cbm: stop.volume,
              load_pallets: stop.pallets,
              load_units: Math.round(stop.units || 0),
              service_duration_minutes: Math.round(stop.serviceTime || 0),
              planned_arrival_at: null, // Will be calculated later based on route sequence
              planned_departure_at: null, // Will be calculated later based on route sequence
              travel_minutes_from_prev: Math.round(stop.driveTimeFromPrevious || 0),
              order_id: orderIds[0] || null, // Primary order ID
              tags: {
                order_ids: orderIds, // All order IDs for this stop
                input_ids: inputIds, // All input IDs for this stop
                order_count: orderCount, // Number of orders consolidated
                consolidated: orderCount > 1 // Flag for UI
              },
              notes: orderCount > 1 ? `${orderCount} ออเดอร์รวมกัน` : null
            };
          });

          console.log(`🔍 Trip ${i + 1} stops to insert:`, {
            tripId: insertedTrip.trip_id,
            stopsCount: stopsToInsert.length,
            firstStop: stopsToInsert[0] ? {
              input_id: stopsToInsert[0].input_id,
              order_id: stopsToInsert[0].order_id,
              stop_name: stopsToInsert[0].stop_name
            } : null
          });

          const { data: insertedStops, error: stopsError } = await supabase
            .from('receiving_route_stops')
            .insert(stopsToInsert)
            .select();

          if (stopsError) {
            console.error(`❌ ERROR: Could not save stops for trip ${i + 1}:`, {
              message: stopsError.message,
              code: stopsError.code,
              details: stopsError.details,
              hint: stopsError.hint,
              tripId: insertedTrip.trip_id,
              stopsCount: stopsToInsert.length
            });
          } else {
            console.log(`✅ Saved ${stopsToInsert.length} stops for trip ${i + 1}`);

            // 10.1 Save stop items for each stop (important for consolidated stops)
            if (insertedStops) {
              for (let stopIdx = 0; stopIdx < insertedStops.length; stopIdx++) {
                const insertedStop = insertedStops[stopIdx];
                const stopData = trip.stops[stopIdx];
                const orderIds = stopData.orderIds || (stopData.orderId ? [stopData.orderId] : []);

                if (orderIds.length === 0) continue;

                // Get all order items for these orders
                const { data: stopOrderItems, error: itemsQueryError } = await supabase
                  .from('wms_order_items')
                  .select('order_item_id, order_id, sku_id, order_qty, order_weight')
                  .in('order_id', orderIds);

                if (itemsQueryError) {
                  console.error(`❌ ERROR: Could not fetch order items for stop ${insertedStop.stop_id}:`, itemsQueryError.message);
                  continue;
                }

                if (!stopOrderItems || stopOrderItems.length === 0) continue;

                // Get SKU names
                const itemSkuIds = [...new Set(stopOrderItems.map(item => item.sku_id).filter(Boolean))];
                const { data: itemSkus } = await supabase
                  .from('master_sku')
                  .select('sku_id, sku_name')
                  .in('sku_id', itemSkuIds);

                const skuNameMap = new Map(itemSkus?.map(s => [s.sku_id, s.sku_name]) || []);

                // Create stop items
                const stopItemsToInsert = stopOrderItems.map(item => ({
                  plan_id: planId,
                  trip_id: insertedTrip.trip_id,
                  stop_id: insertedStop.stop_id,
                  order_id: item.order_id,
                  order_item_id: item.order_item_id,
                  sku_id: item.sku_id,
                  sku_name: skuNameMap.get(item.sku_id) || null,
                  allocated_quantity: item.order_qty,
                  allocated_weight_kg: item.order_weight
                }));

                const { error: stopItemsError } = await supabase
                  .from('receiving_route_stop_items')
                  .insert(stopItemsToInsert);

                if (stopItemsError) {
                  console.error(`❌ ERROR: Could not save stop items for stop ${insertedStop.stop_id}:`, stopItemsError.message);
                } else {
                  console.log(`✅ Saved ${stopItemsToInsert.length} items for stop ${insertedStop.stop_id}`);
                }
              }
            }
          }
        }
      }
    } catch (dbError: any) {
      console.warn('Database save warning:', dbError.message);
      // Continue execution - optimization was successful even if DB save failed
    }

    // 11. Update plan status and metrics
    const totalDistance = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalDistance || 0), 0);
    const totalDriveTime = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalDriveTime || 0), 0);
    const totalServiceTime = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalServiceTime || 0), 0);
    const totalCost = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalCost || 0), 0);
    const totalWeight = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalWeight || 0), 0);
    const totalVolume = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalVolume || 0), 0);
    const totalPallets = allTrips.reduce((sum: number, trip: any) => sum + (trip.totalPallets || 0), 0);
    const totalStops = allTrips.reduce((sum: number, trip: any) => sum + (trip.stops?.length || 0), 0);

    // Update plan - เก็บสถานะเป็น draft เพื่อให้ผู้ใช้ตรวจสอบและ publish เอง
    const { error: planUpdateError } = await supabase
      .from('receiving_route_plans')
      .update({
        status: 'draft', // เก็บเป็น draft ให้ผู้ใช้กด Publish เอง
        total_trips: allTrips.length,
        total_distance_km: totalDistance,
        total_drive_minutes: Math.round(totalDriveTime),
        total_service_minutes: Math.round(totalServiceTime),
        total_weight_kg: totalWeight,
        total_volume_cbm: totalVolume,
        total_pallets: totalPallets,
        // ไม่บันทึก objective_value (ต้นทุน) อัตโนมัติ - ให้คำนวณจากค่าขนส่งที่ผู้ใช้กรอก
        objective_value: null,
        completed_optimization_at: new Date().toISOString()
      })
      .eq('plan_id', planId);

    if (planUpdateError) {
      console.error('❌ ERROR: Failed to update route plan:', {
        planId,
        error: planUpdateError.message,
        code: planUpdateError.code,
        details: planUpdateError.details
      });
    } else {
      console.log('✅ Route plan updated successfully:', {
        planId,
        total_trips: allTrips.length,
        total_distance_km: totalDistance,
        total_weight_kg: totalWeight,
        total_cost: totalCost
      });
    }

    // Update or insert metrics
    await supabase
      .from('receiving_route_plan_metrics')
      .upsert({
        plan_id: planId,
        total_trips: allTrips.length,
        total_orders: deliveries.length,
        total_distance_km: totalDistance,
        total_duration_minutes: totalDriveTime + totalServiceTime,
        total_cost: totalCost,
        avg_distance_per_trip: allTrips.length > 0 ? totalDistance / allTrips.length : 0,
        avg_orders_per_trip: allTrips.length > 0 ? deliveries.length / allTrips.length : 0
      }, {
        onConflict: 'plan_id'
      });

    console.log(`Optimization complete: ${allTrips.length} trips, ${totalDistance.toFixed(2)} km, ${totalCost.toFixed(2)} THB`);

    return NextResponse.json({
      data: {
        planId,
        trips: allTrips.length,
        summary: {
          totalVehicles: allTrips.length,
          totalDistance: totalDistance,
          totalDriveTime: totalDriveTime,
          totalCost: totalCost,
          totalWeight: totalWeight,
          totalDeliveries: deliveries.length
        }
      },
      error: null
    });

  } catch (error: any) {
    console.error('Error optimizing route plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

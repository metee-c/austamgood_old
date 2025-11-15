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

    // 2. Fetch inputs (orders to deliver)
    const { data: inputs, error: inputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .select('*')
      .eq('plan_id', planId)
      .eq('is_active', true);

    if (inputsError || !inputs || inputs.length === 0) {
      return NextResponse.json(
        { error: 'No active inputs found for this plan' },
        { status: 400 }
      );
    }

    const settings = plan.settings || {};
    const warehouseLocation = {
      latitude: settings.warehouseLat || plan.warehouse?.latitude || 13.5838323,
      longitude: settings.warehouseLng || plan.warehouse?.longitude || 100.7576916
    };

    // 3. Prepare deliveries data and consolidate orders by location
    // Group inputs by customer location (stopName + lat/lng combination)
    const locationGroups = new Map<string, any[]>();

    for (const input of inputs) {
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
      // Sum up weights, volumes, etc. from all orders going to this location
      const totalWeight = groupInputs.reduce((sum, inp) => sum + (inp.demand_weight_kg || 0), 0);
      const totalVolume = groupInputs.reduce((sum, inp) => sum + (inp.demand_volume_cbm || 0), 0);
      const totalUnits = groupInputs.reduce((sum, inp) => sum + (inp.demand_units || 0), 0);
      const totalPallets = groupInputs.reduce((sum, inp) => sum + (inp.demand_pallets || 0), 0);

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
        units: totalUnits,
        pallets: totalPallets,
        serviceTime: representative.service_duration_minutes || settings.serviceTime || 15,
        priority: Math.max(...groupInputs.map((inp: any) => inp.priority || 50)),
        timeWindowStart: representative.time_window_start,
        timeWindowEnd: representative.time_window_end,
        orderCount: groupInputs.length
      };
    });

    console.log(`Starting optimization for plan ${planId} with ${deliveries.length} stops (from ${inputs.length} orders)`);

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
      const tripsToInsert = allTrips.map((trip: any, index: number) => ({
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
        fuel_cost_estimate: trip.totalCost || 0,
        is_overweight: trip.isOverweight || false,
        notes: trip.zoneName ? `โซน: ${trip.zoneName}` : null
      }));

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

          const { error: stopsError } = await supabase
            .from('receiving_route_stops')
            .insert(stopsToInsert);

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

    // Update plan
    await supabase
      .from('receiving_route_plans')
      .update({
        status: 'optimized',
        total_trips: allTrips.length,
        total_distance_km: totalDistance,
        total_drive_minutes: totalDriveTime,
        total_service_minutes: totalServiceTime,
        total_weight_kg: totalWeight,
        completed_optimization_at: new Date().toISOString()
      })
      .eq('plan_id', planId);

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

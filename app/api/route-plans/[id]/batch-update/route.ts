import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

interface MoveChange {
  orderId: number;
  fromTripId: number | string;
  toTripId: number | string;
  newSequence: number;
}

interface ReorderChange {
  tripId: number | string;
  orderedStopIds: (number | string)[];
}

interface SplitChange {
  orderId: number;
  sourceStopId: number | string;
  targetTripId: number | string | 'new';
  splitWeightKg: number;
  splitItems?: { orderItemId: number; quantity: number; weightKg: number }[];
}

interface DeleteChange {
  stopId: number | string;
  orderId: number;
  tripId: number | string;
}

interface NewTripChange {
  tripName?: string;
}

interface BatchUpdateRequest {
  moves: MoveChange[];
  reorders: ReorderChange[];
  splits: SplitChange[];
  newTrips: NewTripChange[];
  deletes?: DeleteChange[];
}

/**
 * ใช้ SQL function สำหรับ batch update ใน transaction
 * แก้ไข Bug #7 - Batch Update Transaction
 * ป้องกัน partial update โดยใช้ atomic operations
 */
async function batchUpdateWithTransaction(
  supabase: any,
  moves: MoveChange[],
  reorders: ReorderChange[],
  deletes: DeleteChange[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // แปลง moves, reorders, deletes เป็น format ที่ SQL function รับได้
    const movesJson = moves.map(m => ({
      orderId: m.orderId,
      fromTripId: typeof m.fromTripId === 'string' ? null : m.fromTripId,
      toTripId: typeof m.toTripId === 'string' ? null : m.toTripId
    })).filter(m => m.fromTripId && m.toTripId);

    const reordersJson = reorders.map(r => ({
      tripId: typeof r.tripId === 'string' ? null : r.tripId,
      orderedStopIds: r.orderedStopIds.filter(id => typeof id === 'number')
    })).filter(r => r.tripId && r.orderedStopIds.length > 0);

    const deletesJson = deletes.map(d => ({
      stopId: typeof d.stopId === 'string' ? null : d.stopId,
      orderId: d.orderId,
      tripId: typeof d.tripId === 'string' ? null : d.tripId
    })).filter(d => d.stopId);

    console.log('🔄 Calling batch_update_route_stops function:', {
      movesCount: movesJson.length,
      reordersCount: reordersJson.length,
      deletesCount: deletesJson.length
    });

    // เรียก SQL function ที่ทำงานใน transaction
    const { data, error } = await supabase.rpc('batch_update_route_stops', {
      p_moves: movesJson,
      p_reorders: reordersJson,
      p_deletes: deletesJson
    });

    if (error) {
      console.error('❌ Batch update transaction failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Batch update transaction succeeded:', data);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Batch update transaction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to materialize trips from optimizedTrips settings
 * This converts fallback trips to real database records
 */
async function materializeTripsFromSettings(
  supabase: any,
  planId: string,
  optimizedTrips: any[]
): Promise<Map<string, number>> {
  const fallbackToRealIdMap = new Map<string, number>();
  
  // Get plan date for daily trip number
  const { data: planData } = await supabase
    .from('receiving_route_plans')
    .select('plan_date')
    .eq('plan_id', planId)
    .single();
  
  const planDate = planData?.plan_date 
    ? new Date(planData.plan_date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  console.log('🔄 Materializing trips from optimizedTrips:', {
    planId,
    planDate,
    tripsCount: optimizedTrips.length
  });

  for (let tripIndex = 0; tripIndex < optimizedTrips.length; tripIndex++) {
    const trip = optimizedTrips[tripIndex];
    const fallbackTripId = `fallback-${tripIndex + 1}`;
    
    // Get next daily trip number (function returns the next available number directly)
    const { data: nextDailyNumber, error: rpcError } = await supabase
      .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
    
    if (rpcError) {
      console.error('Error getting next daily trip number:', rpcError);
      continue;
    }
    
    // Create trip - use nextDailyNumber directly (it's already the next available number)
    const { data: createdTrip, error: tripError } = await supabase
      .from('receiving_route_trips')
      .insert({
        plan_id: Number(planId),
        trip_sequence: tripIndex + 1,
        daily_trip_number: nextDailyNumber || 1,
        trip_code: `TRIP-${String(tripIndex + 1).padStart(3, '0')}`,
        trip_status: 'planned',
        total_distance_km: Math.round(trip.totalDistance || 0),
        total_drive_minutes: Math.round(trip.totalDriveTime || 0),
        total_service_minutes: Math.round(trip.totalServiceTime || 0),
        total_weight_kg: Math.round(trip.totalWeight || 0),
        notes: trip.zoneName || `คันที่ ${nextDailyNumber || 1}`
      })
      .select()
      .single();

    if (tripError) {
      console.error('Error creating trip:', tripError);
      continue;
    }

    fallbackToRealIdMap.set(fallbackTripId, createdTrip.trip_id);
    console.log(`✅ Created trip: ${fallbackTripId} -> ${createdTrip.trip_id}`);

    // Create stops for this trip
    const stops = trip.stops || [];
    for (let stopIndex = 0; stopIndex < stops.length; stopIndex++) {
      const stop = stops[stopIndex];
      const fallbackStopId = `fallback-stop-${tripIndex + 1}-${stopIndex + 1}`;
      
      // Handle both orderId (single) and orderIds (array)
      const orderIds = Array.isArray(stop.orderIds) ? stop.orderIds : (stop.orderId ? [stop.orderId] : []);
      const primaryOrderId = orderIds[0] || null;

      // Create stop
      const { data: createdStop, error: stopError } = await supabase
        .from('receiving_route_stops')
        .insert({
          trip_id: createdTrip.trip_id,
          plan_id: Number(planId),
          sequence_no: stopIndex + 1,
          order_id: primaryOrderId,
          stop_name: stop.stopName || stop.address || `จุดที่ ${stopIndex + 1}`,
          address: stop.address || null,
          latitude: stop.latitude || null,
          longitude: stop.longitude || null,
          load_weight_kg: stop.weight || 0,
          service_duration_minutes: stop.serviceTime || 0,
          customer_id: stop.customerId || null,
          tags: {
            order_ids: orderIds,
            customer_id: stop.customerId || null
          }
        })
        .select()
        .single();

      if (stopError) {
        console.error('Error creating stop:', stopError);
        continue;
      }

      fallbackToRealIdMap.set(fallbackStopId, createdStop.stop_id);

      // Update order status to 'route_planned'
      if (orderIds.length > 0) {
        await supabase
          .from('wms_orders')
          .update({
            status: 'route_planned',
            updated_at: new Date().toISOString()
          })
          .in('order_id', orderIds);
      }
    }
  }

  // Clear optimizedTrips from settings since we've materialized them
  // Get current settings first, then update without optimizedTrips
  const { data: currentPlan } = await supabase
    .from('receiving_route_plans')
    .select('settings')
    .eq('plan_id', planId)
    .single();

  if (currentPlan?.settings) {
    const { optimizedTrips, ...remainingSettings } = currentPlan.settings;
    await supabase
      .from('receiving_route_plans')
      .update({
        settings: remainingSettings,
        updated_at: new Date().toISOString()
      })
      .eq('plan_id', planId);
  }

  console.log('✅ Materialized trips mapping:', Object.fromEntries(fallbackToRealIdMap));
  return fallbackToRealIdMap;
}

/**
 * Batch update API for Excel-style route editor
 * Handles moves, reorders, splits, and new trips in a single transaction
 */
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body: BatchUpdateRequest = await request.json();

    const { moves, reorders, splits, newTrips, deletes } = body;
    
    console.log('📥 Batch update request received:', {
      planId,
      movesCount: moves?.length || 0,
      reordersCount: reorders?.length || 0,
      splitsCount: splits?.length || 0,
      newTripsCount: newTrips?.length || 0,
      deletesCount: deletes?.length || 0,
      moves: moves?.slice(0, 3),
      reorders: reorders?.map(r => ({ tripId: r.tripId, stopIdsCount: r.orderedStopIds?.length }))
    });
    
    const results: any = {
      moves: [],
      reorders: [],
      splits: [],
      newTrips: [],
      deletes: [],
      materialized: false
    };

    // Check if we need to materialize trips from settings (fallback mode)
    let fallbackToRealIdMap = new Map<string, number>();
    
    // Detect if any IDs are fallback IDs
    const hasFallbackIds = [
      ...(deletes || []).map(d => d.stopId),
      ...(deletes || []).map(d => d.tripId),
      ...(moves || []).map(m => m.fromTripId),
      ...(moves || []).map(m => m.toTripId),
      ...(reorders || []).map(r => r.tripId),
      ...(splits || []).map(s => s.sourceStopId),
      ...(splits || []).map(s => s.targetTripId)
    ].some(id => typeof id === 'string' && id.toString().startsWith('fallback-'));

    if (hasFallbackIds) {
      console.log('🔍 Detected fallback IDs, checking if materialization needed...');
      
      // Check if trips exist in database
      const { data: existingTrips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id')
        .eq('plan_id', planId)
        .limit(1);

      if (!existingTrips || existingTrips.length === 0) {
        // No trips in database - need to materialize from settings
        const { data: planData } = await supabase
          .from('receiving_route_plans')
          .select('settings')
          .eq('plan_id', planId)
          .single();

        if (planData?.settings?.optimizedTrips) {
          fallbackToRealIdMap = await materializeTripsFromSettings(
            supabase,
            planId,
            planData.settings.optimizedTrips
          );
          results.materialized = true;
        }
      }
    }

    // Helper to resolve fallback IDs to real IDs
    const resolveFallbackId = (id: number | string): number | string => {
      if (typeof id === 'string' && id.startsWith('fallback-')) {
        const realId = fallbackToRealIdMap.get(id);
        if (realId) return realId;
      }
      return id;
    };

    // 1. Create new trips first (if any)
    // Map from index (0, 1, 2...) to actual trip_id
    const newTripIds: Map<number, number> = new Map();
    
    if (newTrips && newTrips.length > 0) {
      // Get plan data to get plan_date
      const { data: planData } = await supabase
        .from('receiving_route_plans')
        .select('plan_date')
        .eq('plan_id', planId)
        .single();
      
      const planDate = planData?.plan_date 
        ? new Date(planData.plan_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Get max trip_sequence for this plan
      const { data: maxSeqData } = await supabase
        .from('receiving_route_trips')
        .select('trip_sequence')
        .eq('plan_id', planId)
        .order('trip_sequence', { ascending: false })
        .limit(1)
        .single();

      let nextSeq = (maxSeqData?.trip_sequence || 0) + 1;

      // เตรียมข้อมูล trips สำหรับ insert
      const tripsToInsert = newTrips.map((newTrip, i) => ({
        plan_id: Number(planId),
        trip_sequence: nextSeq + i,
        trip_code: `TRIP-${String(nextSeq + i).padStart(3, '0')}`,
        trip_status: 'planned',
        notes: newTrip.tripName || `คันที่ ${nextSeq + i}`
      }));

      // ใช้ RPC เพื่อ insert พร้อม daily_trip_number ที่ไม่ซ้ำกัน
      const { data: insertResult, error: insertError } = await supabase
        .rpc('insert_trips_with_daily_numbers', {
          p_plan_date: planDate,
          p_trips: tripsToInsert
        });

      if (insertError) {
        console.error('Error creating new trips via RPC:', insertError);
        // Fallback: ใช้วิธีเดิม
        for (let i = 0; i < newTrips.length; i++) {
          const newTrip = newTrips[i];
          const { data: maxDailyNumber } = await supabase
            .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
          
          const { data: createdTrip, error: createError } = await supabase
            .from('receiving_route_trips')
            .insert({
              plan_id: Number(planId),
              trip_sequence: nextSeq + i,
              daily_trip_number: (maxDailyNumber || 0) + 1,
              trip_code: `TRIP-${String(nextSeq + i).padStart(3, '0')}`,
              trip_status: 'planned',
              notes: newTrip.tripName || `คันที่ ${nextSeq + i}`
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating new trip:', createError);
            continue;
          }

          newTripIds.set(i, createdTrip.trip_id);
          results.newTrips.push({
            index: i,
            virtualTripNumber: nextSeq + i,
            actualTripId: createdTrip.trip_id
          });
        }
      } else {
        // RPC สำเร็จ - ดึง trips ที่สร้างใหม่
        const tripIds = insertResult?.trip_ids || [];
        for (let i = 0; i < tripIds.length; i++) {
          newTripIds.set(i, tripIds[i]);
          results.newTrips.push({
            index: i,
            virtualTripNumber: nextSeq + i,
            actualTripId: tripIds[i]
          });
        }
      }
      
      console.log('Created new trips:', {
        count: newTripIds.size,
        mapping: Array.from(newTripIds.entries())
      });
    }

    // Helper function to resolve trip ID (handles both real IDs and virtual new trip markers)
    const resolveTripId = (tripIdOrMarker: number | string): number | null => {
      // First, resolve any fallback IDs to real IDs
      const resolvedId = resolveFallbackId(tripIdOrMarker);
      
      // Handle "new-{index}" format for new trips
      if (typeof resolvedId === 'string') {
        if (resolvedId.startsWith('new-')) {
          const index = parseInt(resolvedId.replace('new-', ''));
          if (!isNaN(index) && newTripIds.has(index)) {
            return newTripIds.get(index)!;
          }
          // New trip not yet created - will be handled in newTrips processing
          return null;
        }
        if (resolvedId.startsWith('fallback-')) {
          // Fallback ID that wasn't materialized - skip
          console.warn('Unresolved fallback ID:', resolvedId);
          return null;
        }
        // Try to parse as number
        const parsed = parseInt(resolvedId);
        return isNaN(parsed) ? null : parsed;
      }
      return resolvedId as number;
    };

    // 1.5. Process deletes (remove stops from route plan)
    if (deletes && deletes.length > 0) {
      for (const del of deletes) {
        // Resolve fallback IDs first
        const resolvedStopId = resolveFallbackId(del.stopId);
        const stopId = typeof resolvedStopId === 'string' ? parseInt(resolvedStopId) : resolvedStopId;
        const tripId = resolveTripId(del.tripId);

        if (!stopId || isNaN(stopId)) {
          console.warn('Skipping delete - invalid stop ID:', del);
          continue;
        }

        console.log('🗑️ Deleting stop:', { stopId, orderId: del.orderId, tripId });

        // Delete stop items first
        const { error: deleteItemsError } = await supabase
          .from('receiving_route_stop_items')
          .delete()
          .eq('stop_id', stopId);

        if (deleteItemsError) {
          console.error('Error deleting stop items:', deleteItemsError);
        }

        // Delete the stop
        const { error: deleteStopError } = await supabase
          .from('receiving_route_stops')
          .delete()
          .eq('stop_id', stopId);

        if (deleteStopError) {
          console.error('Error deleting stop:', deleteStopError);
          continue;
        }

        // Revert order status back to 'confirmed' (remove from route plan)
        const { error: orderUpdateError } = await supabase
          .from('wms_orders')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', del.orderId);

        if (orderUpdateError) {
          console.error('Error reverting order status:', orderUpdateError);
        }

        // Resequence remaining stops in the trip
        if (tripId) {
          const { data: remainingStops } = await supabase
            .from('receiving_route_stops')
            .select('stop_id')
            .eq('trip_id', tripId)
            .order('sequence_no', { ascending: true });

          if (remainingStops) {
            for (let i = 0; i < remainingStops.length; i++) {
              await supabase
                .from('receiving_route_stops')
                .update({ sequence_no: i + 1 })
                .eq('stop_id', remainingStops[i].stop_id);
            }
          }
        }

        results.deletes.push({
          stopId,
          orderId: del.orderId,
          tripId
        });
      }
    }

    // 2. Process moves (order transfers between trips)
    if (moves && moves.length > 0) {
      for (const move of moves) {
        const fromTripId = resolveTripId(move.fromTripId);
        const toTripId = resolveTripId(move.toTripId);

        if (!fromTripId || !toTripId) {
          console.warn('Skipping move - invalid trip IDs:', move);
          continue;
        }

        // Find the stop containing this order
        const { data: stops } = await supabase
          .from('receiving_route_stops')
          .select('*')
          .eq('trip_id', fromTripId);

        const stopWithOrder = stops?.find(stop => {
          if (stop.order_id === move.orderId) return true;
          if (stop.tags?.order_ids?.includes(move.orderId)) return true;
          return false;
        });

        if (!stopWithOrder) {
          console.warn('Stop not found for order:', move.orderId);
          continue;
        }

        // Check if this is a consolidated stop with multiple orders
        const orderIdsInStop: number[] = stopWithOrder.tags?.order_ids || 
          (stopWithOrder.order_id ? [stopWithOrder.order_id] : []);
        const isConsolidatedStop = orderIdsInStop.length > 1;

        // Get max sequence in target trip
        const { data: targetStops } = await supabase
          .from('receiving_route_stops')
          .select('sequence_no')
          .eq('trip_id', toTripId)
          .order('sequence_no', { ascending: false })
          .limit(1);

        const newSeq = (targetStops?.[0]?.sequence_no || 0) + 1;

        if (isConsolidatedStop) {
          // Consolidated stop: extract only the selected order to a new stop
          console.log('Moving single order from consolidated stop:', {
            orderId: move.orderId,
            stopId: stopWithOrder.stop_id,
            totalOrdersInStop: orderIdsInStop.length
          });

          // Get order details for the order being moved
          const { data: orderData } = await supabase
            .from('wms_orders')
            .select('order_id, order_no, customer_id, total_order_weight_kg')
            .eq('order_id', move.orderId)
            .single();

          // Get order items for weight calculation
          const { data: orderItems } = await supabase
            .from('wms_order_items')
            .select('order_item_id, order_weight')
            .eq('order_id', move.orderId);

          const orderWeight = orderItems?.reduce((sum, item) => sum + Number(item.order_weight || 0), 0) 
            || Number(orderData?.total_order_weight_kg || 0);

          // Create new stop in target trip for the moved order
          const { data: newStop, error: createStopError } = await supabase
            .from('receiving_route_stops')
            .insert({
              trip_id: toTripId,
              plan_id: Number(planId),
              sequence_no: newSeq,
              order_id: move.orderId,
              stop_name: stopWithOrder.stop_name,
              address: stopWithOrder.address,
              latitude: stopWithOrder.latitude,
              longitude: stopWithOrder.longitude,
              load_weight_kg: orderWeight,
              service_duration_minutes: stopWithOrder.service_duration_minutes,
              customer_id: stopWithOrder.customer_id,
              tags: {
                order_ids: [move.orderId],
                customer_id: stopWithOrder.tags?.customer_id || stopWithOrder.customer_id,
                moved_from_stop_id: stopWithOrder.stop_id
              }
            })
            .select()
            .single();

          if (createStopError) {
            console.error('Error creating new stop for moved order:', createStopError);
            continue;
          }

          // Copy stop items for the moved order to new stop
          const { data: existingStopItems } = await supabase
            .from('receiving_route_stop_items')
            .select('*')
            .eq('stop_id', stopWithOrder.stop_id)
            .eq('order_id', move.orderId);

          if (existingStopItems && existingStopItems.length > 0) {
            const newStopItems = existingStopItems.map(item => ({
              plan_id: Number(planId),
              trip_id: toTripId,
              stop_id: newStop.stop_id,
              order_id: item.order_id,
              order_item_id: item.order_item_id,
              sku_id: item.sku_id,
              sku_name: item.sku_name,
              allocated_quantity: item.allocated_quantity,
              allocated_weight_kg: item.allocated_weight_kg,
              notes: `ย้ายจาก stop ${stopWithOrder.stop_id}`
            }));

            await supabase
              .from('receiving_route_stop_items')
              .insert(newStopItems);

            // Delete old stop items for this order
            await supabase
              .from('receiving_route_stop_items')
              .delete()
              .eq('stop_id', stopWithOrder.stop_id)
              .eq('order_id', move.orderId);
          }

          // Update source stop: remove the moved order from tags.order_ids
          const remainingOrderIds = orderIdsInStop.filter(id => id !== move.orderId);
          
          // Recalculate source stop weight
          const { data: remainingStopItems } = await supabase
            .from('receiving_route_stop_items')
            .select('allocated_weight_kg')
            .eq('stop_id', stopWithOrder.stop_id);

          const remainingWeight = remainingStopItems?.reduce(
            (sum, item) => sum + Number(item.allocated_weight_kg || 0), 0
          ) || (Number(stopWithOrder.load_weight_kg || 0) - orderWeight);

          if (remainingOrderIds.length === 0) {
            // No orders left in source stop - delete it
            await supabase
              .from('receiving_route_stop_items')
              .delete()
              .eq('stop_id', stopWithOrder.stop_id);

            await supabase
              .from('receiving_route_stops')
              .delete()
              .eq('stop_id', stopWithOrder.stop_id);
          } else {
            // Update source stop with remaining orders
            const newPrimaryOrderId = remainingOrderIds[0];
            await supabase
              .from('receiving_route_stops')
              .update({
                order_id: newPrimaryOrderId,
                load_weight_kg: Math.max(0, remainingWeight),
                tags: {
                  ...stopWithOrder.tags,
                  order_ids: remainingOrderIds
                },
                updated_at: new Date().toISOString()
              })
              .eq('stop_id', stopWithOrder.stop_id);
          }

          results.moves.push({
            orderId: move.orderId,
            sourceStopId: stopWithOrder.stop_id,
            newStopId: newStop.stop_id,
            fromTripId,
            toTripId,
            newSequence: newSeq,
            wasConsolidated: true
          });

        } else {
          // Single order stop: move the entire stop
          const { error: updateError } = await supabase
            .from('receiving_route_stops')
            .update({
              trip_id: toTripId,
              sequence_no: newSeq,
              updated_at: new Date().toISOString()
            })
            .eq('stop_id', stopWithOrder.stop_id);

          if (updateError) {
            console.error('Error moving stop:', updateError);
            continue;
          }

          // Update stop items trip_id as well
          await supabase
            .from('receiving_route_stop_items')
            .update({ trip_id: toTripId })
            .eq('stop_id', stopWithOrder.stop_id);

          results.moves.push({
            orderId: move.orderId,
            stopId: stopWithOrder.stop_id,
            fromTripId,
            toTripId,
            newSequence: newSeq,
            wasConsolidated: false
          });
        }

        // Resequence remaining stops in source trip
        const { data: remainingStops } = await supabase
          .from('receiving_route_stops')
          .select('stop_id')
          .eq('trip_id', fromTripId)
          .order('sequence_no', { ascending: true });

        if (remainingStops) {
          for (let i = 0; i < remainingStops.length; i++) {
            await supabase
              .from('receiving_route_stops')
              .update({ sequence_no: i + 1 })
              .eq('stop_id', remainingStops[i].stop_id);
          }
        }
      }
    }

    // 3. Process reorders (sequence changes within same trip)
    if (reorders && reorders.length > 0) {
      console.log('📋 Processing reorders:', {
        count: reorders.length,
        reorders: reorders.map(r => ({
          tripId: r.tripId,
          stopIdsCount: r.orderedStopIds.length,
          stopIds: r.orderedStopIds
        }))
      });
      
      for (const reorder of reorders) {
        const tripId = resolveTripId(reorder.tripId);
        if (!tripId) {
          console.warn('⚠️ Skipping reorder - invalid trip ID:', reorder.tripId);
          continue;
        }

        const stopIds = reorder.orderedStopIds
          .map(id => typeof id === 'string' ? parseInt(id as string) : id)
          .filter((id): id is number => id !== null && !isNaN(id));

        if (stopIds.length === 0) {
          console.warn('⚠️ Skipping reorder - no valid stop IDs');
          continue;
        }

        console.log('🔄 Reordering stops:', { tripId, stopIds });

        // Use 2-phase update to avoid unique constraint violations
        const tempOffset = 10000;

        // Phase 1: Set temporary sequence numbers
        for (let i = 0; i < stopIds.length; i++) {
          const { error } = await supabase
            .from('receiving_route_stops')
            .update({ sequence_no: tempOffset + i + 1 })
            .eq('stop_id', stopIds[i]);
          
          if (error) {
            console.error('Error in phase 1 reorder:', { stopId: stopIds[i], error });
          }
        }

        // Phase 2: Set final sequence numbers
        for (let i = 0; i < stopIds.length; i++) {
          const { error } = await supabase
            .from('receiving_route_stops')
            .update({ 
              sequence_no: i + 1,
              updated_at: new Date().toISOString()
            })
            .eq('stop_id', stopIds[i]);
          
          if (error) {
            console.error('Error in phase 2 reorder:', { stopId: stopIds[i], error });
          }
        }

        results.reorders.push({
          tripId,
          stopsReordered: stopIds.length
        });
        
        console.log('✅ Reorder completed:', { tripId, stopsReordered: stopIds.length });
      }
    }

    // 4. Process splits (order weight splits)
    if (splits && splits.length > 0) {
      for (const split of splits) {
        let targetTripId: number | null = null;

        if (split.targetTripId === 'new') {
          // Create a new trip for the split
          const { data: maxSeqData } = await supabase
            .from('receiving_route_trips')
            .select('trip_sequence')
            .eq('plan_id', planId)
            .order('trip_sequence', { ascending: false })
            .limit(1)
            .single();

          const nextSeq = (maxSeqData?.trip_sequence || 0) + 1;

          const { data: newTrip, error: newTripError } = await supabase
            .from('receiving_route_trips')
            .insert({
              plan_id: Number(planId),
              trip_sequence: nextSeq,
              daily_trip_number: nextSeq,
              trip_code: `TRIP-${String(nextSeq).padStart(3, '0')}`,
              trip_status: 'planned',
              notes: `คันที่ ${nextSeq} (แบ่ง)`
            })
            .select()
            .single();

          if (newTripError || !newTrip) {
            console.error('Error creating trip for split:', newTripError);
            continue;
          }

          targetTripId = newTrip.trip_id;
        } else {
          targetTripId = resolveTripId(split.targetTripId);
        }

        if (!targetTripId) continue;

        // Get source stop
        const sourceStopId = typeof split.sourceStopId === 'string' ? null : split.sourceStopId;
        if (!sourceStopId) continue;

        const { data: sourceStop } = await supabase
          .from('receiving_route_stops')
          .select('*')
          .eq('stop_id', sourceStopId)
          .single();

        if (!sourceStop) continue;

        // Get max sequence in target trip
        const { data: targetStops } = await supabase
          .from('receiving_route_stops')
          .select('sequence_no')
          .eq('trip_id', targetTripId)
          .order('sequence_no', { ascending: false })
          .limit(1);

        const newSeq = (targetStops?.[0]?.sequence_no || 0) + 1;

        // Create new stop for split portion
        const { data: newStop, error: newStopError } = await supabase
          .from('receiving_route_stops')
          .insert({
            trip_id: targetTripId,
            plan_id: Number(planId),
            sequence_no: newSeq,
            order_id: split.orderId,
            stop_name: sourceStop.stop_name,
            address: sourceStop.address,
            latitude: sourceStop.latitude,
            longitude: sourceStop.longitude,
            load_weight_kg: split.splitWeightKg,
            service_duration_minutes: sourceStop.service_duration_minutes,
            notes: `แบ่งจาก stop ${sourceStopId}`,
            tags: {
              order_ids: [split.orderId],
              split_from_stop_id: sourceStopId,
              split_item_ids: split.splitItems?.map(i => i.orderItemId) || []
            }
          })
          .select()
          .single();

        if (newStopError) {
          console.error('Error creating split stop:', newStopError);
          continue;
        }

        // Insert records into receiving_route_stop_items for the NEW stop (moved items)
        if (split.splitItems && split.splitItems.length > 0) {
          // Get item details from wms_order_items
          const orderItemIds = split.splitItems.map(i => i.orderItemId);
          const { data: orderItemsData } = await supabase
            .from('wms_order_items')
            .select('order_item_id, sku_id, sku_name')
            .in('order_item_id', orderItemIds);

          const itemDetailsMap: Record<number, any> = {};
          orderItemsData?.forEach(item => {
            itemDetailsMap[item.order_item_id] = item;
          });

          const newStopItems = split.splitItems.map(item => {
            const itemDetail = itemDetailsMap[item.orderItemId];
            return {
              plan_id: Number(planId),
              trip_id: targetTripId,
              stop_id: newStop.stop_id,
              order_id: split.orderId,
              order_item_id: item.orderItemId,
              sku_id: itemDetail?.sku_id || null,
              sku_name: itemDetail?.sku_name || null,
              allocated_quantity: item.quantity,
              allocated_weight_kg: item.weightKg,
              notes: `แบ่งจาก stop ${sourceStopId}`
            };
          });

          const { error: insertItemsError } = await supabase
            .from('receiving_route_stop_items')
            .insert(newStopItems);

          if (insertItemsError) {
            console.error('Error inserting stop items for new stop:', insertItemsError);
          }

          // Check if source stop already has records in receiving_route_stop_items
          const { data: existingSourceItems } = await supabase
            .from('receiving_route_stop_items')
            .select('*')
            .eq('stop_id', sourceStopId);

          if (!existingSourceItems || existingSourceItems.length === 0) {
            // Source stop doesn't have item records yet - create them for remaining items
            const { data: allOrderItems } = await supabase
              .from('wms_order_items')
              .select('order_item_id, sku_id, sku_name, order_qty, order_weight')
              .eq('order_id', split.orderId);

            if (allOrderItems) {
              // Create a map of moved item quantities
              const movedItemsMap: Record<number, { qty: number; weight: number }> = {};
              split.splitItems.forEach(item => {
                movedItemsMap[item.orderItemId] = {
                  qty: item.quantity,
                  weight: item.weightKg
                };
              });

              // Create records for remaining quantities in source stop
              const sourceStopItems = allOrderItems
                .map(orderItem => {
                  const moved = movedItemsMap[orderItem.order_item_id];
                  const originalQty = Number(orderItem.order_qty) || 0;
                  const originalWeight = Number(orderItem.order_weight) || 0;
                  
                  const remainingQty = moved ? originalQty - moved.qty : originalQty;
                  const remainingWeight = moved ? originalWeight - moved.weight : originalWeight;

                  // Only create record if there's remaining quantity
                  if (remainingQty > 0) {
                    return {
                      plan_id: Number(planId),
                      trip_id: sourceStop.trip_id,
                      stop_id: sourceStopId,
                      order_id: split.orderId,
                      order_item_id: orderItem.order_item_id,
                      sku_id: orderItem.sku_id,
                      sku_name: orderItem.sku_name,
                      allocated_quantity: remainingQty,
                      allocated_weight_kg: remainingWeight,
                      notes: 'คงเหลือหลังแบ่ง'
                    };
                  }
                  return null;
                })
                .filter(item => item !== null);

              if (sourceStopItems.length > 0) {
                const { error: insertSourceItemsError } = await supabase
                  .from('receiving_route_stop_items')
                  .insert(sourceStopItems);

                if (insertSourceItemsError) {
                  console.error('Error inserting stop items for source stop:', insertSourceItemsError);
                }
              }
            }
          } else {
            // Source stop already has item records - update them
            for (const item of split.splitItems) {
              const existingItem = existingSourceItems.find(
                ei => ei.order_item_id === item.orderItemId
              );

              if (existingItem) {
                const newQty = (existingItem.allocated_quantity || 0) - item.quantity;
                const newWeight = (existingItem.allocated_weight_kg || 0) - item.weightKg;

                if (newQty <= 0) {
                  // Delete the record if no quantity remaining
                  await supabase
                    .from('receiving_route_stop_items')
                    .delete()
                    .eq('stop_item_id', existingItem.stop_item_id);
                } else {
                  // Update with remaining quantity
                  await supabase
                    .from('receiving_route_stop_items')
                    .update({
                      allocated_quantity: newQty,
                      allocated_weight_kg: newWeight
                    })
                    .eq('stop_item_id', existingItem.stop_item_id);
                }
              }
            }
          }

          // Update source stop tags to track split
          const existingSplitOutItemIds = sourceStop.tags?.split_out_item_ids || [];
          const newSplitOutItemIds = [...existingSplitOutItemIds, ...split.splitItems.map(i => i.orderItemId)];
          
          await supabase
            .from('receiving_route_stops')
            .update({
              tags: {
                ...sourceStop.tags,
                split_out_item_ids: newSplitOutItemIds,
                has_split: true
              }
            })
            .eq('stop_id', sourceStopId);

          // Calculate source stop weight from actual remaining items in receiving_route_stop_items
          const { data: remainingItems } = await supabase
            .from('receiving_route_stop_items')
            .select('allocated_weight_kg')
            .eq('stop_id', sourceStopId);

          const calculatedSourceWeight = remainingItems?.reduce(
            (sum, item) => sum + Number(item.allocated_weight_kg || 0), 0
          ) || 0;

          if (calculatedSourceWeight <= 0) {
            // Delete source stop if no weight remaining
            await supabase
              .from('receiving_route_stop_items')
              .delete()
              .eq('stop_id', sourceStopId);

            await supabase
              .from('receiving_route_stops')
              .delete()
              .eq('stop_id', sourceStopId);
          } else {
            await supabase
              .from('receiving_route_stops')
              .update({ 
                load_weight_kg: calculatedSourceWeight,
                updated_at: new Date().toISOString()
              })
              .eq('stop_id', sourceStopId);
          }
        } else {
          // No split items - use simple weight subtraction (legacy behavior)
          const newSourceWeight = (sourceStop.load_weight_kg || 0) - split.splitWeightKg;
          
          if (newSourceWeight <= 0) {
            await supabase
              .from('receiving_route_stops')
              .delete()
              .eq('stop_id', sourceStopId);
          } else {
            await supabase
              .from('receiving_route_stops')
              .update({ 
                load_weight_kg: newSourceWeight,
                updated_at: new Date().toISOString()
              })
              .eq('stop_id', sourceStopId);
          }
        }

        results.splits.push({
          orderId: split.orderId,
          sourceStopId,
          newStopId: newStop.stop_id,
          targetTripId,
          splitWeight: split.splitWeightKg,
          splitItemsCount: split.splitItems?.length || 0
        });
      }
    }

    // 5. Recalculate trip metrics
    const { data: allTrips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id')
      .eq('plan_id', planId);

    if (allTrips) {
      for (const trip of allTrips) {
        const { data: tripStops } = await supabase
          .from('receiving_route_stops')
          .select('load_weight_kg')
          .eq('trip_id', trip.trip_id);

        const totalWeight = tripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;
        const totalStops = tripStops?.length || 0;

        await supabase
          .from('receiving_route_trips')
          .update({
            total_weight_kg: totalWeight,
            total_stops: totalStops
          })
          .eq('trip_id', trip.trip_id);

        // Delete empty trips
        if (totalStops === 0) {
          await supabase
            .from('receiving_route_trips')
            .delete()
            .eq('trip_id', trip.trip_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Batch update completed',
      results
    });

  } catch (error: any) {
    console.error('Error in batch update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

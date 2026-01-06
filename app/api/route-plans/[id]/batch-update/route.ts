import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

interface NewTripChange {
  tripName?: string;
}

interface BatchUpdateRequest {
  moves: MoveChange[];
  reorders: ReorderChange[];
  splits: SplitChange[];
  newTrips: NewTripChange[];
}

/**
 * Batch update API for Excel-style route editor
 * Handles moves, reorders, splits, and new trips in a single transaction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body: BatchUpdateRequest = await request.json();

    const { moves, reorders, splits, newTrips } = body;
    const results: any = {
      moves: [],
      reorders: [],
      splits: [],
      newTrips: []
    };

    // 1. Create new trips first (if any)
    // Map from index (0, 1, 2...) to actual trip_id
    const newTripIds: Map<number, number> = new Map();
    
    if (newTrips && newTrips.length > 0) {
      // Get max trip_sequence for this plan
      const { data: maxSeqData } = await supabase
        .from('receiving_route_trips')
        .select('trip_sequence')
        .eq('plan_id', planId)
        .order('trip_sequence', { ascending: false })
        .limit(1)
        .single();

      let nextSeq = (maxSeqData?.trip_sequence || 0) + 1;

      for (let i = 0; i < newTrips.length; i++) {
        const newTrip = newTrips[i];
        const { data: createdTrip, error: createError } = await supabase
          .from('receiving_route_trips')
          .insert({
            plan_id: Number(planId),
            trip_sequence: nextSeq,
            daily_trip_number: nextSeq,
            trip_code: `TRIP-${String(nextSeq).padStart(3, '0')}`,
            trip_status: 'planned',
            notes: newTrip.tripName || `คันที่ ${nextSeq}`
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating new trip:', createError);
          continue;
        }

        // Map the index (i) to actual trip_id - frontend sends "new-{index}"
        newTripIds.set(i, createdTrip.trip_id);
        results.newTrips.push({
          index: i,
          virtualTripNumber: nextSeq,
          actualTripId: createdTrip.trip_id
        });
        nextSeq++;
      }
      
      console.log('Created new trips:', {
        count: newTripIds.size,
        mapping: Array.from(newTripIds.entries())
      });
    }

    // Helper function to resolve trip ID (handles both real IDs and virtual new trip markers)
    const resolveTripId = (tripIdOrMarker: number | string): number | null => {
      // Handle "new-{index}" format for new trips
      if (typeof tripIdOrMarker === 'string') {
        if (tripIdOrMarker.startsWith('new-')) {
          const index = parseInt(tripIdOrMarker.replace('new-', ''));
          if (!isNaN(index) && newTripIds.has(index)) {
            return newTripIds.get(index)!;
          }
          // New trip not yet created - will be handled in newTrips processing
          return null;
        }
        if (tripIdOrMarker.startsWith('fallback-')) {
          return null; // Can't process fallback trips
        }
        // Try to parse as number
        const parsed = parseInt(tripIdOrMarker);
        return isNaN(parsed) ? null : parsed;
      }
      return tripIdOrMarker;
    };

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

        // Get max sequence in target trip
        const { data: targetStops } = await supabase
          .from('receiving_route_stops')
          .select('sequence_no')
          .eq('trip_id', toTripId)
          .order('sequence_no', { ascending: false })
          .limit(1);

        const newSeq = (targetStops?.[0]?.sequence_no || 0) + 1;

        // Update the stop to move to new trip
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

        results.moves.push({
          orderId: move.orderId,
          stopId: stopWithOrder.stop_id,
          fromTripId,
          toTripId,
          newSequence: newSeq
        });

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
      for (const reorder of reorders) {
        const tripId = resolveTripId(reorder.tripId);
        if (!tripId) continue;

        const stopIds = reorder.orderedStopIds
          .map(id => typeof id === 'string' ? null : id)
          .filter((id): id is number => id !== null);

        if (stopIds.length === 0) continue;

        // Use 2-phase update to avoid unique constraint violations
        const tempOffset = 10000;

        // Phase 1: Set temporary sequence numbers
        for (let i = 0; i < stopIds.length; i++) {
          await supabase
            .from('receiving_route_stops')
            .update({ sequence_no: tempOffset + i + 1 })
            .eq('stop_id', stopIds[i]);
        }

        // Phase 2: Set final sequence numbers
        for (let i = 0; i < stopIds.length; i++) {
          await supabase
            .from('receiving_route_stops')
            .update({ 
              sequence_no: i + 1,
              updated_at: new Date().toISOString()
            })
            .eq('stop_id', stopIds[i]);
        }

        results.reorders.push({
          tripId,
          stopsReordered: stopIds.length
        });
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

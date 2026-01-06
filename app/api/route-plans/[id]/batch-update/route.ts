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
            trip_code: `TRIP-${String(nextSeq).padStart(3, '0')}`,
            trip_status: 'planned',
            trip_name: newTrip.tripName || `คันที่ ${nextSeq}`
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating new trip:', createError);
          continue;
        }

        // Map the virtual trip number to actual trip_id
        newTripIds.set(nextSeq, createdTrip.trip_id);
        results.newTrips.push({
          virtualTripNumber: nextSeq,
          actualTripId: createdTrip.trip_id
        });
        nextSeq++;
      }
    }

    // Helper function to resolve trip ID (handles both real IDs and virtual new trip numbers)
    const resolveTripId = (tripIdOrNumber: number | string): number | null => {
      if (typeof tripIdOrNumber === 'string' && tripIdOrNumber.startsWith('fallback-')) {
        return null; // Can't process fallback trips
      }
      const num = Number(tripIdOrNumber);
      if (newTripIds.has(num)) {
        return newTripIds.get(num)!;
      }
      return num;
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
              trip_code: `TRIP-${String(nextSeq).padStart(3, '0')}`,
              trip_status: 'planned',
              trip_name: `คันที่ ${nextSeq} (แบ่ง)`
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
              split_from_stop_id: sourceStopId
            }
          })
          .select()
          .single();

        if (newStopError) {
          console.error('Error creating split stop:', newStopError);
          continue;
        }

        // Update source stop weight
        const newSourceWeight = (sourceStop.load_weight_kg || 0) - split.splitWeightKg;
        
        if (newSourceWeight <= 0) {
          // Delete source stop if no weight remaining
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

        results.splits.push({
          orderId: split.orderId,
          sourceStopId,
          newStopId: newStop.stop_id,
          targetTripId,
          splitWeight: split.splitWeightKg
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

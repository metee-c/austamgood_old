import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body = await request.json();

    const { orderId, fromTripId, toTripId } = body;

    if (!orderId || !fromTripId || !toTripId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, fromTripId, toTripId' },
        { status: 400 }
      );
    }

    // 1. Find the stop containing this order_id (could be in tags.order_ids for consolidated stops)
    const { data: allStops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .eq('trip_id', fromTripId);

    if (stopsError) {
      return NextResponse.json({ error: stopsError.message }, { status: 500 });
    }

    if (!allStops || allStops.length === 0) {
      return NextResponse.json(
        { error: 'No stops found in the specified trip' },
        { status: 404 }
      );
    }

    // Find the stop that contains this order (either as primary order_id or in tags.order_ids)
    const stopWithOrder = allStops.find(stop => {
      if (stop.order_id === orderId) return true;
      if (stop.tags?.order_ids && Array.isArray(stop.tags.order_ids)) {
        return stop.tags.order_ids.includes(orderId);
      }
      return false;
    });

    if (!stopWithOrder) {
      return NextResponse.json(
        { error: 'Order not found in the specified trip' },
        { status: 404 }
      );
    }

    // Check if this is a consolidated stop with multiple orders
    const orderIds = stopWithOrder.tags?.order_ids || [stopWithOrder.order_id];
    const isConsolidatedStop = orderIds.length > 1;

    // 2. Get the highest sequence_no in the target trip
    const { data: targetStops, error: targetError } = await supabase
      .from('receiving_route_stops')
      .select('sequence_no')
      .eq('trip_id', toTripId)
      .order('sequence_no', { ascending: false })
      .limit(1);

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }

    const newSequenceNo = (targetStops && targetStops.length > 0)
      ? targetStops[0].sequence_no + 1
      : 1;

    let movedStopId: number;

    if (isConsolidatedStop) {
      // Case 1: Moving one order from a consolidated stop
      // Need to: 1) Remove this order from the original stop, 2) Create a new stop in target trip

      // Get the order's allocated weight from route_plan_inputs
      const inputIds = stopWithOrder.tags?.input_ids || [];
      const inputIndex = orderIds.indexOf(orderId);
      const inputId = inputIds[inputIndex];

      let orderWeight = 0;
      if (inputId) {
        const { data: inputData } = await supabase
          .from('receiving_route_plan_inputs')
          .select('demand_weight_kg, demand_volume_cbm, demand_units, demand_pallets')
          .eq('input_id', inputId)
          .single();

        if (inputData) {
          orderWeight = inputData.demand_weight_kg || 0;
        }
      }

      // If can't get from input, split weight evenly
      if (!orderWeight) {
        orderWeight = Number(stopWithOrder.load_weight_kg || 0) / orderIds.length;
      }

      // Calculate remaining orders and their data
      const remainingOrderIds = orderIds.filter((id: number) => id !== orderId);
      const remainingInputIds = inputIds.filter((_: any, idx: number) => orderIds[idx] !== orderId);
      const remainingWeight = Number(stopWithOrder.load_weight_kg || 0) - orderWeight;

      // Strategy: 
      // 1. First, update the original stop to move to new trip (this frees up the sequence_no)
      // 2. Then, create new stop for remaining orders in original trip
      
      // Step 1: Update original stop to move to new trip with single order
      const { error: updateError } = await supabase
        .from('receiving_route_stops')
        .update({
          trip_id: toTripId,
          sequence_no: newSequenceNo,
          order_id: orderId,
          load_weight_kg: orderWeight,
          load_volume_cbm: Number(stopWithOrder.load_volume_cbm || 0) / orderIds.length,
          load_pallets: Math.round(Number(stopWithOrder.load_pallets || 0) / orderIds.length),
          load_units: Math.round(Number(stopWithOrder.load_units || 0) / orderIds.length),
          tags: {
            order_ids: [orderId],
            input_ids: inputId ? [inputId] : [],
            order_count: 1,
            consolidated: false
          },
          notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('stop_id', stopWithOrder.stop_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      movedStopId = stopWithOrder.stop_id;

      // Step 2: Create new stop for remaining orders in the ORIGINAL trip (if any)
      if (remainingOrderIds.length > 0) {
        // Get the highest sequence_no in the original trip AFTER the move
        const { data: currentFromStops } = await supabase
          .from('receiving_route_stops')
          .select('sequence_no')
          .eq('trip_id', fromTripId)
          .order('sequence_no', { ascending: false })
          .limit(1);

        const nextSequenceNo = (currentFromStops && currentFromStops.length > 0)
          ? currentFromStops[0].sequence_no + 1
          : 1;

        const { error: insertError } = await supabase
          .from('receiving_route_stops')
          .insert({
            trip_id: fromTripId, // Stay in original trip
            plan_id: planId,
            sequence_no: nextSequenceNo, // Use next available sequence number
            input_id: null, // Don't use input_id to avoid constraint
            stop_type: stopWithOrder.stop_type,
            status: stopWithOrder.status,
            stop_name: stopWithOrder.stop_name,
            address: stopWithOrder.address,
            latitude: stopWithOrder.latitude,
            longitude: stopWithOrder.longitude,
            load_weight_kg: remainingWeight,
            load_volume_cbm: Number(stopWithOrder.load_volume_cbm || 0) * (remainingOrderIds.length / orderIds.length),
            load_pallets: Math.round(Number(stopWithOrder.load_pallets || 0) * (remainingOrderIds.length / orderIds.length)),
            load_units: Math.round(Number(stopWithOrder.load_units || 0) * (remainingOrderIds.length / orderIds.length)),
            service_duration_minutes: stopWithOrder.service_duration_minutes,
            order_id: remainingOrderIds[0],
            tags: {
              order_ids: remainingOrderIds,
              input_ids: remainingInputIds,
              order_count: remainingOrderIds.length,
              consolidated: remainingOrderIds.length > 1
            },
            notes: remainingOrderIds.length > 1 ? `${remainingOrderIds.length} ออเดอร์รวมกัน` : null
          });

        if (insertError) {
          console.error('Error inserting remaining orders stop:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    } else {
      // Case 2: Moving a single-order stop (original behavior)
      const { error: updateError } = await supabase
        .from('receiving_route_stops')
        .update({
          trip_id: toTripId,
          sequence_no: newSequenceNo,
          updated_at: new Date().toISOString()
        })
        .eq('stop_id', stopWithOrder.stop_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      movedStopId = stopWithOrder.stop_id;
    }

    // 4. Reorder sequence numbers in the source trip
    const { data: remainingStops, error: remainingError } = await supabase
      .from('receiving_route_stops')
      .select('stop_id, sequence_no')
      .eq('trip_id', fromTripId)
      .order('sequence_no', { ascending: true });

    if (!remainingError && remainingStops) {
      for (let i = 0; i < remainingStops.length; i++) {
        await supabase
          .from('receiving_route_stops')
          .update({ sequence_no: i + 1 })
          .eq('stop_id', remainingStops[i].stop_id);
      }
    }

    // 5. Recalculate trip metrics (weight, distance, etc.)
    // Recalculate trip metrics (weight and stop count)
    const { data: fromTripStops } = await supabase
      .from('receiving_route_stops')
      .select('load_weight_kg')
      .eq('trip_id', fromTripId);

    const { data: toTripStops } = await supabase
      .from('receiving_route_stops')
      .select('load_weight_kg')
      .eq('trip_id', toTripId);

    const fromTripWeight = fromTripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;
    const toTripWeight = toTripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;

    // Calculate distances for both trips using optimized route (nearest to farthest)
    const { data: fromDistanceData } = await supabase.rpc('calculate_trip_distance_optimized', {
      p_trip_id: fromTripId
    });
    const fromDistance = fromDistanceData || 0;
    const fromDriveMinutes = Math.round(fromDistance * 1.2);

    const { data: toDistanceData } = await supabase.rpc('calculate_trip_distance_optimized', {
      p_trip_id: toTripId
    });
    const toDistance = toDistanceData || 0;
    const toDriveMinutes = Math.round(toDistance * 1.2);

    await supabase
      .from('receiving_route_trips')
      .update({
        total_weight_kg: fromTripWeight,
        total_stops: fromTripStops?.length || 0,
        total_distance_km: fromDistance,
        total_drive_minutes: fromDriveMinutes,
        updated_at: new Date().toISOString()
      })
      .eq('trip_id', fromTripId);

    await supabase
      .from('receiving_route_trips')
      .update({
        total_weight_kg: toTripWeight,
        total_stops: toTripStops?.length || 0,
        total_distance_km: toDistance,
        total_drive_minutes: toDriveMinutes,
        updated_at: new Date().toISOString()
      })
      .eq('trip_id', toTripId);

    // 6. ลบ trip ที่ไม่มี stop เหลืออยู่
    let deletedEmptyTrip = false;
    if (!fromTripStops || fromTripStops.length === 0) {
      const { error: deleteTripError } = await supabase
        .from('receiving_route_trips')
        .delete()
        .eq('trip_id', fromTripId);

      if (deleteTripError) {
        console.error('Error deleting empty trip:', deleteTripError);
      } else {
        deletedEmptyTrip = true;
        console.log(`Deleted empty trip ${fromTripId}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: deletedEmptyTrip 
        ? 'Order moved successfully and empty trip was deleted' 
        : 'Order moved successfully',
      data: {
        movedStopId,
        fromTripId,
        toTripId,
        newSequenceNo,
        wasConsolidated: isConsolidatedStop,
        deletedEmptyTrip,
        fromTripDistance: fromDistance,
        toTripDistance: toDistance,
        fromTripDriveMinutes: fromDriveMinutes,
        toTripDriveMinutes: toDriveMinutes
      }
    });

  } catch (error: any) {
    console.error('Error moving order:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
interface SplitStopItem {
  orderItemId: number;
  moveWeightKg: number;
  moveQuantity: number;
  moveVolumeCbm?: number;
  movePallets?: number;
}

interface SplitStopRequestBody {
  sourceStopId: number;
  targetTripId?: number | null;
  newTrip?: {
    trip_name?: string | null;
  };
  items: SplitStopItem[];
  serviceDurationMinutes?: number | null;
  note?: string | null;
}

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body: SplitStopRequestBody = await request.json();

    const {
      sourceStopId,
      targetTripId,
      newTrip,
      items,
      serviceDurationMinutes,
      note
    } = body;

    // Validate required fields
    if (!sourceStopId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Get source stop information
    const { data: sourceStop, error: sourceStopError } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .eq('stop_id', sourceStopId)
      .single();

    if (sourceStopError || !sourceStop) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล stop ต้นทาง' },
        { status: 404 }
      );
    }

    // Validate all items belong to the same order and get item details
    const orderIds = new Set<number>();
    const itemDetailsMap: Record<number, any> = {};
    
    for (const item of items) {
      const { data: orderItem } = await supabase
        .from('wms_order_items')
        .select('order_id, sku_id, sku_name, order_qty, order_weight')
        .eq('order_item_id', item.orderItemId)
        .single();

      if (orderItem) {
        orderIds.add(orderItem.order_id);
        itemDetailsMap[item.orderItemId] = orderItem;
      }
    }

    if (orderIds.size !== 1) {
      return NextResponse.json(
        { error: 'รายการที่เลือกต้องมาจากออเดอร์เดียวกัน' },
        { status: 400 }
      );
    }

    const orderId = Array.from(orderIds)[0];

    // CRITICAL: Validate that items belong to the same order as the source stop
    if (sourceStop.order_id && sourceStop.order_id !== orderId) {
      console.error('Order ID mismatch:', {
        sourceStopOrderId: sourceStop.order_id,
        itemsOrderId: orderId,
        sourceStopId
      });
      return NextResponse.json(
        { error: `รายการที่เลือกไม่ตรงกับออเดอร์ของ stop ต้นทาง (Stop Order: ${sourceStop.order_id}, Items Order: ${orderId})` },
        { status: 400 }
      );
    }

    // ✅ FIX: ตรวจสอบว่า items ที่จะ split ยังไม่ถูก split ไปแล้ว
    const splitOutItemIds = sourceStop.tags?.split_out_item_ids || [];
    const alreadySplitItems = items.filter(item => splitOutItemIds.includes(item.orderItemId));
    if (alreadySplitItems.length > 0) {
      return NextResponse.json(
        { error: `รายการที่เลือกถูก split ไปแล้ว: ${alreadySplitItems.map(i => i.orderItemId).join(', ')}` },
        { status: 400 }
      );
    }

    // Calculate total weight and quantity being moved
    const totalMoveWeight = items.reduce((sum, item) => sum + item.moveWeightKg, 0);
    const totalMoveQty = items.reduce((sum, item) => sum + (item.moveQuantity || 0), 0);

    // Determine target trip
    let finalTargetTripId = targetTripId;

    // If creating new trip
    if (!targetTripId && newTrip) {
      const { data: plan } = await supabase
        .from('receiving_route_plans')
        .select('vehicle_id, plan_date')
        .eq('plan_id', planId)
        .single();

      if (!plan) {
        return NextResponse.json(
          { error: 'ไม่พบข้อมูล route plan' },
          { status: 404 }
        );
      }

      const planDate = plan.plan_date 
        ? new Date(plan.plan_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Get max trip_sequence for this plan
      const { data: maxSeqData } = await supabase
        .from('receiving_route_trips')
        .select('trip_sequence')
        .eq('plan_id', planId)
        .order('trip_sequence', { ascending: false })
        .limit(1)
        .single();

      const nextTripSeq = (maxSeqData?.trip_sequence ?? 0) + 1;

      // เตรียมข้อมูล trip สำหรับ insert
      const tripToInsert = [{
        plan_id: Number(planId),
        trip_sequence: nextTripSeq,
        trip_code: `TRIP-${String(nextTripSeq).padStart(3, '0')}`,
        trip_status: 'planned',
        notes: newTrip.trip_name || `คันที่ ${nextTripSeq} (แบ่ง)`
      }];

      // ใช้ RPC เพื่อ insert พร้อม daily_trip_number ที่ไม่ซ้ำกัน
      const { data: insertResult, error: insertError } = await supabase
        .rpc('insert_trips_with_daily_numbers', {
          p_plan_date: planDate,
          p_trips: tripToInsert
        });

      let newTripData: any = null;

      if (insertError) {
        console.error('Error creating new trip via RPC:', insertError);
        // Fallback: ใช้วิธีเดิมพร้อม advisory lock
        const { data: maxDailyNumber } = await supabase
          .rpc('get_next_daily_trip_number', { p_plan_date: planDate });
        
        const { data: fallbackTrip, error: fallbackError } = await supabase
          .from('receiving_route_trips')
          .insert({
            plan_id: Number(planId),
            trip_sequence: nextTripSeq,
            daily_trip_number: (maxDailyNumber || 0) + 1,
            trip_code: `TRIP-${String(nextTripSeq).padStart(3, '0')}`,
            trip_status: 'planned',
            notes: newTrip.trip_name || `คันที่ ${nextTripSeq} (แบ่ง)`
          })
          .select()
          .single();

        if (fallbackError || !fallbackTrip) {
          return NextResponse.json(
            { error: 'ไม่สามารถสร้าง trip ใหม่ได้' },
            { status: 500 }
          );
        }
        newTripData = fallbackTrip;
      } else {
        // RPC สำเร็จ - ดึง trip ที่สร้างใหม่
        const tripIds = insertResult?.trip_ids || [];
        if (tripIds.length > 0) {
          const { data: createdTrip } = await supabase
            .from('receiving_route_trips')
            .select('*')
            .eq('trip_id', tripIds[0])
            .single();
          newTripData = createdTrip;
        }
      }

      if (!newTripData) {
        return NextResponse.json(
          { error: 'ไม่สามารถสร้าง trip ใหม่ได้' },
          { status: 500 }
        );
      }

      finalTargetTripId = newTripData.trip_id;
    }

    if (!finalTargetTripId) {
      return NextResponse.json(
        { error: 'ไม่พบ trip ปลายทาง' },
        { status: 400 }
      );
    }

    // Get max sequence_no for target trip
    const { data: maxSeqStop } = await supabase
      .from('receiving_route_stops')
      .select('sequence_no')
      .eq('trip_id', finalTargetTripId)
      .order('sequence_no', { ascending: false })
      .limit(1)
      .single();

    const nextSeqNo = (maxSeqStop?.sequence_no ?? 0) + 1;

    // Create new stop in target trip with split_from_stop_id to track origin
    const { data: newStop, error: newStopError } = await supabase
      .from('receiving_route_stops')
      .insert({
        trip_id: finalTargetTripId,
        plan_id: Number(planId),
        order_id: orderId,
        sequence_no: nextSeqNo,
        stop_name: sourceStop.stop_name,
        address: sourceStop.address,
        latitude: sourceStop.latitude,
        longitude: sourceStop.longitude,
        load_weight_kg: totalMoveWeight,
        service_duration_minutes: serviceDurationMinutes ?? sourceStop.service_duration_minutes,
        notes: note,
        tags: {
          order_ids: [orderId],
          split_from_stop_id: sourceStopId,
          split_item_ids: items.map(i => i.orderItemId)
        }
      })
      .select()
      .single();

    if (newStopError || !newStop) {
      console.error('Error creating new stop:', newStopError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง stop ใหม่ได้' },
        { status: 500 }
      );
    }

    // Insert records into receiving_route_stop_items for the NEW stop (moved items)
    const newStopItems = items.map(item => {
      const itemDetail = itemDetailsMap[item.orderItemId];
      return {
        plan_id: Number(planId),
        trip_id: finalTargetTripId,
        stop_id: newStop.stop_id,
        order_id: orderId,
        order_item_id: item.orderItemId,
        sku_id: itemDetail?.sku_id || null,
        sku_name: itemDetail?.sku_name || null,
        allocated_quantity: item.moveQuantity || 0,
        allocated_weight_kg: item.moveWeightKg || 0,
        allocated_volume_cbm: item.moveVolumeCbm || null,
        allocated_pallets: item.movePallets || null,
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
      // Get all order items for this order
      const { data: allOrderItems } = await supabase
        .from('wms_order_items')
        .select('order_item_id, sku_id, sku_name, order_qty, order_weight')
        .eq('order_id', orderId);

      if (allOrderItems) {
        // Create a map of moved item quantities
        const movedItemsMap: Record<number, { qty: number; weight: number }> = {};
        items.forEach(item => {
          movedItemsMap[item.orderItemId] = {
            qty: item.moveQuantity || 0,
            weight: item.moveWeightKg || 0
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
                order_id: orderId,
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
      for (const item of items) {
        const existingItem = existingSourceItems.find(
          ei => ei.order_item_id === item.orderItemId
        );

        if (existingItem) {
          const newQty = (existingItem.allocated_quantity || 0) - (item.moveQuantity || 0);
          const newWeight = (existingItem.allocated_weight_kg || 0) - (item.moveWeightKg || 0);

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

    // Update source stop weight and tags
    const newSourceWeight = (sourceStop.load_weight_kg || 0) - totalMoveWeight;
    const sourceTripId = sourceStop.trip_id;

    // Update tags to track which items were split out
    const existingSplitItemIds = sourceStop.tags?.split_out_item_ids || [];
    const newSplitOutItemIds = [...existingSplitItemIds, ...items.map(i => i.orderItemId)];

    if (newSourceWeight <= 0) {
      // Delete source stop if no weight remaining
      // First delete any remaining stop_items
      await supabase
        .from('receiving_route_stop_items')
        .delete()
        .eq('stop_id', sourceStopId);

      await supabase
        .from('receiving_route_stops')
        .delete()
        .eq('stop_id', sourceStopId);
    } else {
      // Update source stop weight and tags
      await supabase
        .from('receiving_route_stops')
        .update({
          load_weight_kg: newSourceWeight,
          tags: {
            ...sourceStop.tags,
            split_out_item_ids: newSplitOutItemIds,
            has_split: true
          }
        })
        .eq('stop_id', sourceStopId);
    }

    // Delete empty trip if source trip has no stops left
    let deletedEmptyTrip = false;
    if (sourceTripId) {
      const { data: remainingStops } = await supabase
        .from('receiving_route_stops')
        .select('stop_id')
        .eq('trip_id', sourceTripId);

      if (!remainingStops || remainingStops.length === 0) {
        const { error: deleteTripError } = await supabase
          .from('receiving_route_trips')
          .delete()
          .eq('trip_id', sourceTripId);

        if (deleteTripError) {
          console.error('Error deleting empty trip:', deleteTripError);
        } else {
          deletedEmptyTrip = true;
          console.log(`Deleted empty trip ${sourceTripId}`);
        }
      }
    }

    // Recalculate trip weights and distances
    for (const tripId of [sourceTripId, finalTargetTripId]) {
      if (!tripId) continue;
      
      const { data: tripStops } = await supabase
        .from('receiving_route_stops')
        .select('load_weight_kg')
        .eq('trip_id', tripId);

      const totalWeight = tripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;
      const totalStops = tripStops?.length || 0;

      // Calculate new distance after split
      const { data: distanceData } = await supabase.rpc('calculate_trip_distance', {
        p_trip_id: tripId
      });
      const totalDistance = distanceData || 0;
      const totalDriveMinutes = Math.round(totalDistance * 1.5);

      await supabase
        .from('receiving_route_trips')
        .update({
          total_weight_kg: totalWeight,
          total_stops: totalStops,
          total_distance_km: totalDistance,
          total_drive_minutes: totalDriveMinutes,
          updated_at: new Date().toISOString()
        })
        .eq('trip_id', tripId);
    }

    console.log('✅ Split stop completed:', {
      sourceStopId,
      newStopId: newStop.stop_id,
      targetTripId: finalTargetTripId,
      movedItems: items.length,
      totalMoveWeight,
      totalMoveQty
    });

    return NextResponse.json({
      success: true,
      newStopId: newStop.stop_id,
      newTripId: finalTargetTripId,
      deletedEmptyTrip,
      movedItems: items.length,
      totalMoveWeight,
      totalMoveQty,
      sourceTripDistance: sourceTripId ? (await supabase.rpc('calculate_trip_distance', { p_trip_id: sourceTripId })).data : 0,
      targetTripDistance: finalTargetTripId ? (await supabase.rpc('calculate_trip_distance', { p_trip_id: finalTargetTripId })).data : 0
    });

  } catch (error: any) {
    console.error('Error splitting stop:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

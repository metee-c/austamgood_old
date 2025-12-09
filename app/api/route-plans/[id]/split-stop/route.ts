import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

export async function POST(
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

    // Validate all items belong to the same order
    const orderIds = new Set<number>();
    for (const item of items) {
      const { data: orderItem } = await supabase
        .from('wms_order_items')
        .select('order_id')
        .eq('order_item_id', item.orderItemId)
        .single();

      if (orderItem) {
        orderIds.add(orderItem.order_id);
      }
    }

    if (orderIds.size !== 1) {
      return NextResponse.json(
        { error: 'รายการที่เลือกต้องมาจากออเดอร์เดียวกัน' },
        { status: 400 }
      );
    }

    const orderId = Array.from(orderIds)[0];

    // Calculate total weight and quantity being moved
    const totalMoveWeight = items.reduce((sum, item) => sum + item.moveWeightKg, 0);
    const totalMoveQty = items.reduce((sum, item) => sum + item.moveQuantity, 0);

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

      // Get max trip_order for this plan
      const { data: maxOrderData } = await supabase
        .from('receiving_route_trips')
        .select('trip_order')
        .eq('plan_id', planId)
        .order('trip_order', { ascending: false })
        .limit(1)
        .single();

      const nextTripOrder = (maxOrderData?.trip_order ?? 0) + 1;

      // Create new trip
      const { data: newTripData, error: newTripError } = await supabase
        .from('receiving_route_trips')
        .insert({
          plan_id: Number(planId),
          trip_order: nextTripOrder,
          trip_name: newTrip.trip_name || `Trip ${nextTripOrder}`,
          vehicle_id: plan.vehicle_id,
          plan_date: plan.plan_date
        })
        .select()
        .single();

      if (newTripError || !newTripData) {
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

    // Get max stop_order for target trip
    const { data: maxStopOrder } = await supabase
      .from('receiving_route_stops')
      .select('stop_order')
      .eq('trip_id', finalTargetTripId)
      .order('stop_order', { ascending: false })
      .limit(1)
      .single();

    const nextStopOrder = (maxStopOrder?.stop_order ?? 0) + 1;

    // Create new stop in target trip
    const { data: newStop, error: newStopError } = await supabase
      .from('receiving_route_stops')
      .insert({
        trip_id: finalTargetTripId,
        order_id: orderId,
        stop_order: nextStopOrder,
        stop_name: sourceStop.stop_name,
        latitude: sourceStop.latitude,
        longitude: sourceStop.longitude,
        load_weight_kg: totalMoveWeight,
        service_duration_minutes: serviceDurationMinutes,
        notes: note,
        zone: sourceStop.zone,
        subzone: sourceStop.subzone
      })
      .select()
      .single();

    if (newStopError || !newStop) {
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง stop ใหม่ได้' },
        { status: 500 }
      );
    }

    // Update source stop weight
    const newSourceWeight = (sourceStop.load_weight_kg || 0) - totalMoveWeight;

    if (newSourceWeight <= 0) {
      // Delete source stop if no weight remaining
      await supabase
        .from('receiving_route_stops')
        .delete()
        .eq('stop_id', sourceStopId);
    } else {
      // Update source stop weight
      await supabase
        .from('receiving_route_stops')
        .update({
          load_weight_kg: newSourceWeight
        })
        .eq('stop_id', sourceStopId);
    }

    // TODO: Update order items allocation if needed
    // This depends on how the system tracks which items are allocated to which stops

    return NextResponse.json({
      success: true,
      newStopId: newStop.stop_id,
      newTripId: finalTargetTripId
    });

  } catch (error: any) {
    console.error('Error splitting stop:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

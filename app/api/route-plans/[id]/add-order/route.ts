import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface AddOrderRequest {
  orderId: number | string;
  tripId: number | string;
  sequence?: number; // ถ้าไม่ระบุจะเพิ่มท้ายสุด
}

/**
 * API สำหรับเพิ่มออเดอร์ร่าง (draft) เข้าไปใน trip ที่มีอยู่แล้ว
 * - ออเดอร์ต้องเป็น status = 'draft' และ order_type = 'route_planning'
 * - จะสร้าง stop ใหม่ใน trip ที่ระบุ
 * - อัปเดตสถานะออเดอร์เป็น 'confirmed' (หรือ 'route_planned')
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body: AddOrderRequest = await request.json();

    // แปลง orderId และ tripId เป็น number เพื่อให้แน่ใจว่าเป็นตัวเลข
    const orderId = Number(body.orderId);
    const tripId = Number(body.tripId);
    const sequence = body.sequence;

    console.log('📥 Add order to trip request:', { planId, orderId, tripId, sequence, rawBody: body });

    // ตรวจสอบว่า orderId และ tripId เป็นตัวเลขที่ถูกต้อง
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: `orderId ไม่ถูกต้อง: ${body.orderId}` },
        { status: 400 }
      );
    }

    if (!Number.isFinite(tripId) || tripId <= 0) {
      return NextResponse.json(
        { error: `tripId ไม่ถูกต้อง: ${body.tripId}` },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบว่า trip อยู่ในแผนนี้จริง
    const { data: trip, error: tripError } = await supabase
      .from('receiving_route_trips')
      .select('trip_id, plan_id, daily_trip_number, trip_sequence')
      .eq('trip_id', tripId)
      .eq('plan_id', planId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'ไม่พบเที่ยวรถที่ระบุในแผนนี้' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่าออเดอร์เป็น draft และ order_type = route_planning
    console.log('🔍 Looking for order:', { orderId, orderIdType: typeof orderId });
    
    const { data: order, error: orderError } = await supabase
      .from('wms_orders')
      .select(`
        order_id,
        order_no,
        customer_id,
        shop_name,
        province,
        total_weight,
        status,
        order_type,
        delivery_date,
        notes,
        text_field_long_1
      `)
      .eq('order_id', orderId)
      .single();

    console.log('📦 Order query result:', { order, orderError });

    if (orderError || !order) {
      console.error('❌ Order not found:', { orderId, orderError });
      return NextResponse.json(
        { error: 'ไม่พบออเดอร์ที่ระบุ' },
        { status: 404 }
      );
    }

    if (order.status !== 'draft') {
      return NextResponse.json(
        { error: `ออเดอร์นี้มีสถานะ "${order.status}" ไม่ใช่ "draft" ไม่สามารถเพิ่มได้` },
        { status: 400 }
      );
    }

    if (order.order_type !== 'route_planning') {
      return NextResponse.json(
        { error: `ออเดอร์นี้เป็นประเภท "${order.order_type}" ไม่ใช่ "route_planning" ไม่สามารถเพิ่มได้` },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่าออเดอร์ยังไม่อยู่ในแผนนี้
    const { data: existingStop } = await supabase
      .from('receiving_route_stops')
      .select('stop_id')
      .eq('plan_id', planId)
      .eq('order_id', orderId)
      .limit(1);

    if (existingStop && existingStop.length > 0) {
      return NextResponse.json(
        { error: 'ออเดอร์นี้อยู่ในแผนนี้แล้ว' },
        { status: 400 }
      );
    }

    // 4. ดึงข้อมูลลูกค้าสำหรับพิกัด
    let customerData: any = null;
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from('master_customer')
        .select('customer_id, customer_name, customer_code, latitude, longitude, address, province')
        .eq('customer_id', order.customer_id)
        .single();
      customerData = customer;
    }

    // 5. ดึง order items สำหรับคำนวณน้ำหนักและสร้าง stop items
    const { data: orderItems } = await supabase
      .from('wms_order_items')
      .select('order_item_id, sku_id, sku_name, order_qty, order_weight')
      .eq('order_id', orderId);

    const totalWeight = orderItems?.reduce((sum, item) => sum + Number(item.order_weight || 0), 0) 
      || Number(order.total_weight || 0);

    // 6. หา sequence ถัดไป (ถ้าไม่ระบุ)
    let newSequence = sequence;
    if (!newSequence) {
      const { data: maxSeqData } = await supabase
        .from('receiving_route_stops')
        .select('sequence_no')
        .eq('trip_id', tripId)
        .order('sequence_no', { ascending: false })
        .limit(1);

      newSequence = (maxSeqData?.[0]?.sequence_no || 0) + 1;
    } else {
      // ถ้าระบุ sequence ต้อง shift stops ที่มีอยู่
      const { data: existingStops } = await supabase
        .from('receiving_route_stops')
        .select('stop_id, sequence_no')
        .eq('trip_id', tripId)
        .gte('sequence_no', newSequence)
        .order('sequence_no', { ascending: false });

      // Shift existing stops (from last to first to avoid conflicts)
      if (existingStops && existingStops.length > 0) {
        for (const stop of existingStops) {
          await supabase
            .from('receiving_route_stops')
            .update({ sequence_no: stop.sequence_no + 1 })
            .eq('stop_id', stop.stop_id);
        }
      }
    }

    // 7. สร้าง input record (receiving_route_plan_inputs)
    const { data: input, error: inputError } = await supabase
      .from('receiving_route_plan_inputs')
      .insert({
        plan_id: Number(planId),
        order_id: orderId,
        stop_name: order.shop_name || customerData?.customer_name || order.customer_id,
        address: order.text_field_long_1 || customerData?.address || null,
        latitude: customerData?.latitude || null,
        longitude: customerData?.longitude || null,
        demand_weight_kg: totalWeight,
        demand_units: orderItems?.reduce((sum, item) => sum + Number(item.order_qty || 0), 0) || 0,
        customer_id: order.customer_id
      })
      .select()
      .single();

    if (inputError) {
      console.error('Error creating input:', inputError);
      // Continue anyway - input is optional
    }

    // 8. สร้าง stop ใหม่
    const stopName = order.shop_name || customerData?.customer_name || order.customer_id || `ออเดอร์ ${order.order_no}`;
    const stopAddress = order.text_field_long_1 || customerData?.address || order.province || null;

    const { data: newStop, error: stopError } = await supabase
      .from('receiving_route_stops')
      .insert({
        trip_id: tripId,
        plan_id: Number(planId),
        sequence_no: newSequence,
        order_id: orderId,
        input_id: input?.input_id || null,
        stop_name: stopName,
        address: stopAddress,
        latitude: customerData?.latitude || null,
        longitude: customerData?.longitude || null,
        load_weight_kg: totalWeight,
        service_duration_minutes: 15, // default service time
        customer_id: order.customer_id,
        tags: {
          order_ids: [orderId],
          customer_id: order.customer_id,
          added_manually: true
        }
      })
      .select()
      .single();

    if (stopError) {
      console.error('Error creating stop:', stopError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างจุดส่งได้: ' + stopError.message },
        { status: 500 }
      );
    }

    // 9. สร้าง stop items
    if (orderItems && orderItems.length > 0) {
      const stopItems = orderItems.map(item => ({
        plan_id: Number(planId),
        trip_id: tripId,
        stop_id: newStop.stop_id,
        order_id: orderId,
        order_item_id: item.order_item_id,
        sku_id: item.sku_id,
        sku_name: item.sku_name,
        allocated_quantity: item.order_qty,
        allocated_weight_kg: item.order_weight
      }));

      const { error: itemsError } = await supabase
        .from('receiving_route_stop_items')
        .insert(stopItems);

      if (itemsError) {
        console.error('Error creating stop items:', itemsError);
        // Continue anyway - items are for tracking
      }
    }

    // 10. อัปเดตสถานะออเดอร์เป็น 'confirmed'
    const { error: orderUpdateError } = await supabase
      .from('wms_orders')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (orderUpdateError) {
      console.error('Error updating order status:', orderUpdateError);
    }

    // 11. อัปเดต trip totals
    const { data: tripStops } = await supabase
      .from('receiving_route_stops')
      .select('load_weight_kg')
      .eq('trip_id', tripId);

    const tripTotalWeight = tripStops?.reduce((sum, s) => sum + Number(s.load_weight_kg || 0), 0) || 0;

    await supabase
      .from('receiving_route_trips')
      .update({
        total_weight_kg: tripTotalWeight,
        updated_at: new Date().toISOString()
      })
      .eq('trip_id', tripId);

    console.log('✅ Order added to trip successfully:', {
      orderId,
      orderNo: order.order_no,
      tripId,
      stopId: newStop.stop_id,
      sequence: newSequence,
      weight: totalWeight
    });

    return NextResponse.json({
      success: true,
      data: {
        stop: newStop,
        order: {
          order_id: order.order_id,
          order_no: order.order_no,
          customer_id: order.customer_id,
          shop_name: order.shop_name,
          total_weight: totalWeight
        },
        trip: {
          trip_id: tripId,
          daily_trip_number: trip.daily_trip_number,
          new_total_weight: tripTotalWeight
        }
      },
      message: `เพิ่มออเดอร์ ${order.order_no} เข้าคันที่ ${trip.daily_trip_number} จุดที่ ${newSequence} สำเร็จ`
    });

  } catch (error: any) {
    console.error('Error in add-order API:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มออเดอร์' },
      { status: 500 }
    );
  }
}

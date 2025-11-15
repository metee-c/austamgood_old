import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/route-plans/[id]/add-order
 *
 * เพิ่มออเดอร์แบบ manual เข้าไปในแผนเส้นทางที่มีอยู่แล้ว
 *
 * Request Body:
 * - orderId: number - รหัสออเดอร์ที่ต้องการเพิ่ม
 * - tripId: number - รหัสเที่ยวที่ต้องการเพิ่มเข้าไป
 * - sequencePosition: number - ตำแหน่งลำดับที่ต้องการแทรก
 *
 * การทำงาน:
 * 1. ตรวจสอบออเดอร์และแผนเส้นทาง
 * 2. เปลี่ยนสถานะออเดอร์จาก 'draft' เป็น 'confirmed'
 * 3. อัพเดท delivery_date และ matched_trip_id
 * 4. เพิ่มเข้า receiving_route_plan_inputs
 * 5. สร้าง stop ใหม่ใน receiving_route_stops
 * 6. ปรับลำดับ sequence ของ stops ที่ตามมา
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: planId } = await params;
    const body = await request.json();

    const { orderId, tripId, sequencePosition } = body;

    // Validate required fields
    if (!orderId || !tripId || sequencePosition === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: orderId, tripId, sequencePosition'
        },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบว่าแผนเส้นทางมีอยู่จริง
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, plan_name, plan_date, warehouse_id, vehicle_id')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบแผนเส้นทางที่ระบุ'
        },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่าออเดอร์มีอยู่จริงและมีสถานะ 'draft'
    const { data: order, error: orderError } = await supabase
      .from('wms_orders')
      .select(`
        order_id,
        order_no,
        status,
        customer_id,
        delivery_date,
        master_customer (
          customer_id,
          customer_name,
          customer_code,
          latitude,
          longitude
        )
      `)
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบออเดอร์ที่ระบุ'
        },
        { status: 404 }
      );
    }

    if (order.status !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: `ออเดอร์นี้มีสถานะ '${order.status}' แล้ว ไม่สามารถเพิ่มได้`
        },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่ามี customer location
    const customer = order.master_customer as any;
    if (!customer || !customer.latitude || !customer.longitude) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบข้อมูลพิกัดของลูกค้า กรุณาตรวจสอบข้อมูล Master Customer'
        },
        { status: 400 }
      );
    }

    // 4. ดึงข้อมูล order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('wms_order_items')
      .select(`
        *,
        master_sku (
          sku_code,
          sku_name,
          unit_weight_kg
        )
      `)
      .eq('order_id', orderId);

    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่พบรายการสินค้าในออเดอร์'
        },
        { status: 400 }
      );
    }

    // คำนวณน้ำหนักและจำนวนรวม
    const totalUnits = orderItems.reduce((sum, item) => sum + (item.ordered_qty || 0), 0);
    const totalWeight = orderItems.reduce((sum, item) => {
      const sku = item.master_sku as any;
      const unitWeight = sku?.unit_weight_kg || 0;
      return sum + (item.ordered_qty * unitWeight);
    }, 0);

    // 5. อัพเดทสถานะออเดอร์
    const { error: updateOrderError } = await supabase
      .from('wms_orders')
      .update({
        status: 'confirmed',
        delivery_date: plan.plan_date,
        matched_trip_id: tripId,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updateOrderError) {
      console.error('Error updating order:', updateOrderError);
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่สามารถอัปเดตสถานะออเดอร์ได้'
        },
        { status: 500 }
      );
    }

    // 6. เพิ่มเข้า receiving_route_plan_inputs
    const { data: inputData, error: inputError } = await supabase
      .from('receiving_route_plan_inputs')
      .insert({
        plan_id: Number(planId),
        order_id: orderId,
        customer_id: order.customer_id,
        latitude: customer.latitude,
        longitude: customer.longitude,
        demand_units: totalUnits,
        demand_weight_kg: totalWeight,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (inputError || !inputData) {
      console.error('Error creating input:', inputError);
      // Rollback order status
      await supabase
        .from('wms_orders')
        .update({
          status: 'draft',
          delivery_date: null,
          matched_trip_id: null
        })
        .eq('order_id', orderId);

      return NextResponse.json(
        {
          success: false,
          error: 'ไม่สามารถเพิ่มข้อมูลลงแผนเส้นทางได้'
        },
        { status: 500 }
      );
    }

    // 7. ปรับลำดับ sequence ของ stops ที่มีอยู่แล้วในเที่ยวนี้
    const { data: existingStops, error: stopsError } = await supabase
      .from('receiving_route_stops')
      .select('*')
      .eq('plan_id', planId)
      .eq('trip_id', tripId)
      .gte('sequence', sequencePosition)
      .order('sequence', { ascending: true });

    if (stopsError) {
      console.error('Error fetching existing stops:', stopsError);
    }

    // เพิ่ม sequence ของ stops ที่ตามมา
    if (existingStops && existingStops.length > 0) {
      for (const stop of existingStops) {
        await supabase
          .from('receiving_route_stops')
          .update({ sequence: stop.sequence + 1 })
          .eq('stop_id', stop.stop_id);
      }
    }

    // 8. สร้าง stop ใหม่
    const { data: newStop, error: stopError } = await supabase
      .from('receiving_route_stops')
      .insert({
        plan_id: Number(planId),
        trip_id: tripId,
        order_id: orderId,
        customer_id: order.customer_id,
        sequence: sequencePosition,
        latitude: customer.latitude,
        longitude: customer.longitude,
        load_units: totalUnits,
        load_weight_kg: totalWeight,
        tags: {
          order_ids: [orderId],
          input_ids: [inputData.input_id],
          manually_added: true
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (stopError || !newStop) {
      console.error('Error creating stop:', stopError);
      // Rollback
      await supabase
        .from('receiving_route_plan_inputs')
        .delete()
        .eq('input_id', inputData.input_id);

      await supabase
        .from('wms_orders')
        .update({
          status: 'draft',
          delivery_date: null,
          matched_trip_id: null
        })
        .eq('order_id', orderId);

      return NextResponse.json(
        {
          success: false,
          error: 'ไม่สามารถสร้างจุดส่งใหม่ได้'
        },
        { status: 500 }
      );
    }

    // 9. สร้าง receiving_route_stop_items
    const stopItems = orderItems.map(item => ({
      stop_id: newStop.stop_id,
      order_id: orderId,
      sku_id: item.sku_id,
      quantity: item.ordered_qty,
      weight_kg: (item.master_sku as any)?.unit_weight_kg * item.ordered_qty || 0,
      created_at: new Date().toISOString()
    }));

    const { error: stopItemsError } = await supabase
      .from('receiving_route_stop_items')
      .insert(stopItems);

    if (stopItemsError) {
      console.error('Error creating stop items:', stopItemsError);
      // ไม่ rollback เพราะไม่ critical
    }

    // ส่งผลลัพธ์สำเร็จ
    return NextResponse.json({
      success: true,
      message: `เพิ่มออเดอร์ ${order.order_no} เข้าแผนเส้นทางสำเร็จ`,
      data: {
        order_id: orderId,
        order_no: order.order_no,
        plan_id: planId,
        trip_id: tripId,
        sequence: sequencePosition,
        stop_id: newStop.stop_id,
        input_id: inputData.input_id
      }
    });

  } catch (error: any) {
    console.error('API Error in POST /api/route-plans/[id]/add-order:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการเพิ่มออเดอร์เข้าแผนเส้นทาง'
      },
      { status: 500 }
    );
  }
}

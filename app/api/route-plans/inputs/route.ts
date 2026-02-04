import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an array of inputs', data: null },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // ตรวจสอบว่า orders เหล่านี้มีอยู่ใน plan อื่นที่ยัง active อยู่หรือไม่
    const orderIds = body.map(input => input.order_id).filter(Boolean);
    const planId = body[0]?.plan_id;
    
    if (orderIds.length > 0) {
      // ดึง orders ที่มี stop_items ใน plans อื่นที่ยังไม่ complete
      const { data: existingStopItems } = await supabase
        .from('receiving_route_stop_items')
        .select(`
          order_id,
          stop_id,
          receiving_route_stops!inner (
            trip_id,
            receiving_route_trips!inner (
              plan_id,
              receiving_route_plans!inner (
                plan_id,
                plan_code,
                status
              )
            )
          )
        `)
        .in('order_id', orderIds);

      // กรองเฉพาะ orders ที่อยู่ใน plans อื่นที่ยัง active (ไม่ใช่ completed, cancelled)
      const conflictingOrders = new Map<number, { planCode: string; planId: number; status: string }>();
      
      (existingStopItems || []).forEach((item: any) => {
        const plan = item.receiving_route_stops?.receiving_route_trips?.receiving_route_plans;
        if (plan && plan.plan_id !== Number(planId)) {
          const activeStatuses = ['draft', 'published', 'optimizing', 'approved', 'in_progress'];
          if (activeStatuses.includes(plan.status)) {
            conflictingOrders.set(item.order_id, {
              planCode: plan.plan_code,
              planId: plan.plan_id,
              status: plan.status
            });
          }
        }
      });

      if (conflictingOrders.size > 0) {
        const conflicts = Array.from(conflictingOrders.entries()).map(([orderId, info]) => ({
          order_id: orderId,
          existing_plan_code: info.planCode,
          existing_plan_id: info.planId,
          existing_plan_status: info.status
        }));
        
        console.warn('⚠️ Orders already exist in other active plans:', conflicts);
        return NextResponse.json({
          error: `ออเดอร์บางรายการมีอยู่ในแผนอื่นที่ยัง active อยู่ กรุณาลบออกจากแผนเดิมก่อน หรือใช้ฟังก์ชันย้ายออเดอร์ข้ามแผน`,
          conflicting_orders: conflicts,
          data: null
        }, { status: 400 });
      }
    }

    // Validate required fields for each input
    const validatedInputs = body.map(input => ({
      plan_id: input.plan_id,
      order_id: input.order_id,
      stop_name: input.stop_name || null,
      contact_phone: input.contact_phone || null,
      address: input.address || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      priority: input.priority || 50,
      service_duration_minutes: input.service_duration_minutes || 15,
      ready_time: input.ready_time || null,
      due_time: input.due_time || null,
      is_active: input.is_active !== undefined ? input.is_active : true,
      demand_weight_kg: input.demand_weight_kg || 0,
      demand_units: input.demand_units || 1,
      tags: input.tags || null
    }));

    const { data, error } = await supabase
      .from('receiving_route_plan_inputs')
      .insert(validatedInputs)
      .select();

    if (error) {
      console.error('Error inserting route plan inputs:', error);
      return NextResponse.json(
        { error: error.message, data: null },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error in route plan inputs API:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

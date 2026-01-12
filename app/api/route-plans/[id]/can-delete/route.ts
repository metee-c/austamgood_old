// app/api/route-plans/[id]/can-delete/route.ts
// Phase 2: API ตรวจสอบว่าลบแผนจัดเส้นทางได้หรือไม่

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleGet(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { id } = await context.params;
  const planId = parseInt(id);

  if (isNaN(planId)) {
    return NextResponse.json({ can_delete: false, reason: 'รหัสแผนไม่ถูกต้อง' });
  }

  try {
    // 1. ดึงข้อมูลแผน
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, plan_code, status')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ can_delete: false, reason: 'ไม่พบแผนจัดเส้นทาง' });
    }

    // 2. ตรวจสอบสถานะ - ห้ามลบถ้าอยู่ระหว่างดำเนินการ
    const blockedStatuses = ['in_transit', 'loading', 'completed'];
    if (blockedStatuses.includes(plan.status)) {
      const statusLabels: Record<string, string> = {
        in_transit: 'กำลังจัดส่ง',
        loading: 'กำลังโหลดสินค้า',
        completed: 'เสร็จสิ้นแล้ว'
      };
      return NextResponse.json({
        can_delete: false,
        reason: `แผนมีสถานะ "${statusLabels[plan.status] || plan.status}" ไม่สามารถลบได้`
      });
    }

    // 3. ตรวจสอบ picklists ที่สร้างจากแผนนี้
    const { data: picklists } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('plan_id', planId);

    const hasPicklists = picklists && picklists.length > 0;

    // 4. ถ้ามี picklists ตรวจสอบ orders
    if (hasPicklists) {
      // ดึง trips ของแผนนี้
      const { data: trips } = await supabase
        .from('receiving_route_trips')
        .select('trip_id')
        .eq('plan_id', planId);

      const tripIds = trips?.map(t => t.trip_id) || [];

      if (tripIds.length > 0) {
        // ดึง stops และ order_ids
        const { data: stops } = await supabase
          .from('receiving_route_stops')
          .select('order_id')
          .in('trip_id', tripIds);

        const orderIds = [...new Set(stops?.map(s => s.order_id).filter(Boolean))];

        if (orderIds.length > 0) {
          // ตรวจสอบสถานะ orders
          const { data: orders } = await supabase
            .from('wms_orders')
            .select('order_id, order_no, status, rollback_at')
            .in('order_id', orderIds);

          // หา orders ที่ยังไม่ได้ rollback (status ไม่ใช่ draft และไม่มี rollback_at)
          const activeOrders = orders?.filter(o =>
            o.status !== 'draft' &&
            o.status !== 'cancelled' &&
            !o.rollback_at
          ) || [];

          if (activeOrders.length > 0) {
            return NextResponse.json({
              can_delete: false,
              reason: `ยังมี ${activeOrders.length} orders ที่ยังไม่ได้ Rollback`,
              active_orders: activeOrders.slice(0, 10).map(o => o.order_no), // แสดงแค่ 10 รายการแรก
              picklists_count: picklists.length
            });
          }
        }
      }
    }

    // 5. ลบได้
    return NextResponse.json({
      can_delete: true,
      plan_code: plan.plan_code,
      status: plan.status,
      picklists_count: picklists?.length || 0,
      warning: hasPicklists
        ? `จะลบ ${picklists?.length} ใบหยิบ (Picklist) ที่สร้างจากแผนนี้ด้วย`
        : null
    });

  } catch (err: any) {
    console.error('[can-delete] Error:', err);
    return NextResponse.json({ can_delete: false, reason: err.message });
  }
}

export const GET = withAuth(handleGet);

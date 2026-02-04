// app/api/route-plans/[id]/delete/route.ts
// Phase 1: API ลบแผนจัดเส้นทาง

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function handleDelete(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { id } = await context.params;
  const planId = parseInt(id);
  const userId = context.user?.user_id;

  if (isNaN(planId)) {
    return NextResponse.json(
      { error: 'รหัสแผนไม่ถูกต้อง', error_code: 'INVALID_ID' },
      { status: 400 }
    );
  }

  try {
    // 1. ดึงข้อมูลแผน
    const { data: plan, error: planError } = await supabase
      .from('receiving_route_plans')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'ไม่พบแผนจัดเส้นทาง', error_code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบสถานะแผน - ห้ามลบถ้าอยู่ระหว่างดำเนินการ
    const blockedStatuses = ['in_transit', 'loading', 'completed'];
    if (blockedStatuses.includes(plan.status)) {
      const statusLabels: Record<string, string> = {
        in_transit: 'กำลังจัดส่ง',
        loading: 'กำลังโหลดสินค้า',
        completed: 'เสร็จสิ้นแล้ว'
      };
      return NextResponse.json(
        {
          error: `ไม่สามารถลบแผนที่มีสถานะ "${statusLabels[plan.status] || plan.status}" ได้`,
          error_code: 'INVALID_STATUS'
        },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่ามี picklists ที่สร้างจากแผนนี้หรือไม่
    const { data: picklists, error: picklistError } = await supabase
      .from('picklists')
      .select('id, picklist_code, status')
      .eq('plan_id', planId);

    const hasPicklists = picklists && picklists.length > 0;

    // 4. ดึง trips ของแผนนี้
    const { data: trips } = await supabase
      .from('receiving_route_trips')
      .select('trip_id')
      .eq('plan_id', planId);

    const tripIds = trips?.map(t => t.trip_id) || [];

    // 5. ถ้ามี picklists ต้องตรวจสอบว่า orders ทั้งหมด rollback แล้วหรือยัง
    if (hasPicklists && tripIds.length > 0) {
      // ดึง stops และ order_ids
      const { data: stops } = await supabase
        .from('receiving_route_stops')
        .select('order_id')
        .in('trip_id', tripIds);

      const orderIds = [...new Set(stops?.map(s => s.order_id).filter(Boolean))];

      if (orderIds.length > 0) {
        // ตรวจสอบสถานะ orders
        const { data: orders, error: ordersError } = await supabase
          .from('wms_orders')
          .select('order_id, order_no, status, rollback_at')
          .in('order_id', orderIds);

        if (ordersError) {
          throw ordersError;
        }

        // หา orders ที่ยังไม่ได้ rollback (status ไม่ใช่ draft และไม่มี rollback_at)
        const activeOrders = orders?.filter(o =>
          o.status !== 'draft' &&
          o.status !== 'cancelled' &&
          !o.rollback_at
        ) || [];

        if (activeOrders.length > 0) {
          return NextResponse.json(
            {
              error: `ไม่สามารถลบแผนได้ เนื่องจากยังมี ${activeOrders.length} orders ที่ยังไม่ได้ Rollback`,
              error_code: 'ORDERS_NOT_ROLLBACK',
              active_orders: activeOrders.slice(0, 10).map(o => o.order_no)
            },
            { status: 400 }
          );
        }
      }
    }

    // 6. เริ่มลบข้อมูล (ตามลำดับ dependency)
    console.log(`[delete-route-plan] Starting deletion of plan ${planId} (${plan.plan_code})`);

    // 6.1 ลบ picklist_items
    if (hasPicklists) {
      const picklistIds = picklists.map(p => p.id);

      const { error: deleteItemsError } = await supabase
        .from('picklist_items')
        .delete()
        .in('picklist_id', picklistIds);

      if (deleteItemsError) {
        console.error('Error deleting picklist_items:', deleteItemsError);
      } else {
        console.log(`[delete-route-plan] Deleted picklist_items for ${picklistIds.length} picklists`);
      }

      // 6.2 ลบ picklists
      const { error: deletePicklistsError } = await supabase
        .from('picklists')
        .delete()
        .in('id', picklistIds);

      if (deletePicklistsError) {
        console.error('Error deleting picklists:', deletePicklistsError);
        throw deletePicklistsError;
      }
      console.log(`[delete-route-plan] Deleted ${picklistIds.length} picklists`);
    }

    // 6.3 ลบ route_stop_items
    if (tripIds.length > 0) {
      const { error: deleteStopItemsError } = await supabase
        .from('receiving_route_stop_items')
        .delete()
        .in('trip_id', tripIds);

      if (deleteStopItemsError) {
        console.error('Error deleting stop_items:', deleteStopItemsError);
      } else {
        console.log(`[delete-route-plan] Deleted route_stop_items for ${tripIds.length} trips`);
      }
    }

    // 6.4 ลบ route_stops (ใช้ trip_id)
    if (tripIds.length > 0) {
      const { error: deleteStopsError } = await supabase
        .from('receiving_route_stops')
        .delete()
        .in('trip_id', tripIds);

      if (deleteStopsError) {
        console.error('Error deleting stops:', deleteStopsError);
      } else {
        console.log(`[delete-route-plan] Deleted route_stops`);
      }
    }

    // 6.5 ลบ route_trips
    const { error: deleteTripsError } = await supabase
      .from('receiving_route_trips')
      .delete()
      .eq('plan_id', planId);

    if (deleteTripsError) {
      console.error('Error deleting trips:', deleteTripsError);
    } else {
      console.log(`[delete-route-plan] Deleted ${tripIds.length} trips`);
    }

    // 6.6 ลบ route_plan_inputs
    const { error: deleteInputsError } = await supabase
      .from('receiving_route_plan_inputs')
      .delete()
      .eq('plan_id', planId);

    if (deleteInputsError) {
      console.error('Error deleting inputs:', deleteInputsError);
    } else {
      console.log(`[delete-route-plan] Deleted route_plan_inputs`);
    }

    // 6.7 ลบ route_plan
    const { error: deletePlanError } = await supabase
      .from('receiving_route_plans')
      .delete()
      .eq('plan_id', planId);

    if (deletePlanError) {
      throw deletePlanError;
    }
    console.log(`[delete-route-plan] Deleted route_plan ${plan.plan_code}`);

    // 7. บันทึก Audit Log
    try {
      await supabase.from('audit_logs').insert({
        action: 'ROUTE_PLAN_DELETE',
        user_id: userId,
        details: {
          plan_id: planId,
          plan_code: plan.plan_code,
          deleted_picklists: picklists?.length || 0,
          deleted_trips: tripIds.length
        }
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // ไม่ throw เพราะการลบสำเร็จแล้ว
    }

    return NextResponse.json({
      success: true,
      message: `ลบแผน ${plan.plan_code} สำเร็จ`,
      deleted: {
        plan_code: plan.plan_code,
        picklists: picklists?.length || 0,
        trips: tripIds.length
      }
    });

  } catch (err: any) {
    console.error('[delete-route-plan] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดในการลบแผน', error_code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
}

export const DELETE = withShadowLog(withAuth(handleDelete));

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// User ID ที่อนุญาตให้ลบ batch ได้ (metee)
const ALLOWED_DELETE_USER_ID = 2;

async function handleDelete(request: NextRequest, context: any) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { order_ids } = body;

    // ตรวจสอบสิทธิ์ - เฉพาะ user_id = 2 (metee) เท่านั้น
    const userId = context.user?.user_id;
    if (userId !== ALLOWED_DELETE_USER_ID) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์ลบออเดอร์แบบ batch' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'order_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าออเดอร์ทั้งหมดอยู่ในสถานะที่ลบได้ (draft หรือ confirmed เท่านั้น)
    const { data: ordersToCheck, error: checkError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status')
      .in('order_id', order_ids);

    if (checkError) {
      console.error('Error checking orders:', checkError);
      return NextResponse.json(
        { error: checkError.message },
        { status: 500 }
      );
    }

    // หาออเดอร์ที่ไม่สามารถลบได้
    const nonDeletableOrders = ordersToCheck?.filter(
      (o: any) => !['draft', 'confirmed'].includes(o.status)
    ) || [];

    if (nonDeletableOrders.length > 0) {
      const orderNos = nonDeletableOrders.map((o: any) => o.order_no).join(', ');
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบออเดอร์ที่มีสถานะอื่นนอกจาก "ร่าง" หรือ "ยืนยันแล้ว" ได้`,
          non_deletable_orders: nonDeletableOrders,
          message: `ออเดอร์ต่อไปนี้ไม่สามารถลบได้: ${orderNos}`
        },
        { status: 400 }
      );
    }

    // ลบ order items ก่อน
    const { error: itemsError } = await supabase
      .from('wms_order_items')
      .delete()
      .in('order_id', order_ids);

    if (itemsError) {
      console.error('Error deleting order items:', itemsError);
      return NextResponse.json(
        { error: `ไม่สามารถลบรายการสินค้าได้: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // ลบ orders
    const { data, error } = await supabase
      .from('wms_orders')
      .delete()
      .in('order_id', order_ids)
      .select('order_id, order_no');

    if (error) {
      console.error('Error batch deleting orders:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ User ${userId} deleted ${data?.length || 0} orders:`, data?.map((o: any) => o.order_no));

    return NextResponse.json({
      success: true,
      message: `ลบ ${data?.length || 0} ออเดอร์สำเร็จ`,
      deleted_count: data?.length || 0,
      data
    });

  } catch (error) {
    console.error('Error in DELETE /api/orders/batch-delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const DELETE = withShadowLog(withAuth(handleDelete));

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/orders/[id]/items/[itemId]/rollback
 * Rollback รายการสินค้าเดียวใน Order
 */
async function handlePost(
  request: NextRequest,
  context: { params?: { id: string; itemId: string }; user: any }
) {
try {
    const { id, itemId } = await (context.params as any);
    const orderId = parseInt(id, 10);
    const orderItemId = parseInt(itemId, 10);

    if (isNaN(orderId) || isNaN(orderItemId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID or item ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุเหตุผลในการ Rollback' },
        { status: 400 }
      );
    }

    const userId = context.user.user_id;
    const supabase = createServiceRoleClient();

    // Verify order item belongs to the order
    const { data: orderItem, error: verifyError } = await supabase
      .from('wms_order_items')
      .select('order_item_id, order_id')
      .eq('order_item_id', orderItemId)
      .eq('order_id', orderId)
      .single();

    if (verifyError || !orderItem) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าใน Order นี้' },
        { status: 404 }
      );
    }

    // Execute rollback
    const { data: result, error: rpcError } = await supabase.rpc('execute_order_item_rollback', {
      p_order_item_id: orderItemId,
      p_user_id: userId,
      p_reason: reason.trim(),
      p_warehouse_id: 'WH001'
    });

    if (rpcError) {
      console.error('[item-rollback] RPC error:', rpcError);
      return NextResponse.json(
        { success: false, error: rpcError.message || 'เกิดข้อผิดพลาดในการ Rollback' },
        { status: 500 }
      );
    }

    if (!result || !result.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'Rollback ไม่สำเร็จ' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rollback รายการสินค้าสำเร็จ',
      data: result
    });

  } catch (err: any) {
    console.error('[item-rollback] Exception:', err);

    return NextResponse.json(
      { success: false, error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(withAuth(handlePost));

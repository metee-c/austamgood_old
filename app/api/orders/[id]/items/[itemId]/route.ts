import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * DELETE /api/orders/[id]/items/[itemId]
 * ลบรายการสินค้าที่ถูก Rollback แล้ว
 */
async function handleDelete(
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

    const userId = context.user.user_id;
    const supabase = createServiceRoleClient();

    // Verify order item belongs to the order
    const { data: orderItem, error: verifyError } = await supabase
      .from('wms_order_items')
      .select('order_item_id, order_id, voided_at')
      .eq('order_item_id', orderItemId)
      .eq('order_id', orderId)
      .single();

    if (verifyError || !orderItem) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าใน Order นี้' },
        { status: 404 }
      );
    }

    // Execute delete
    const { data: result, error: rpcError } = await supabase.rpc('delete_voided_order_item', {
      p_order_item_id: orderItemId,
      p_user_id: userId
    });

    if (rpcError) {
      console.error('[item-delete] RPC error:', rpcError);
      return NextResponse.json(
        { success: false, error: rpcError.message || 'เกิดข้อผิดพลาดในการลบ' },
        { status: 500 }
      );
    }

    if (!result || !result.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'ลบไม่สำเร็จ' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบรายการสินค้าสำเร็จ',
      data: result
    });

  } catch (err: any) {
    console.error('[item-delete] Exception:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const DELETE = withShadowLog(withAuth(handleDelete));

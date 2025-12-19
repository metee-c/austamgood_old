import { NextRequest, NextResponse } from 'next/server';
import { orderRollbackService } from '@/lib/database/order-rollback';

/**
 * GET /api/orders/[id]/rollback-history
 * ดึงประวัติการ Rollback ของ Order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const { data, error } = await orderRollbackService.getRollbackHistory(orderId);

    if (error) {
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error('[rollback-history] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

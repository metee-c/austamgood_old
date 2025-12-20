import { NextRequest, NextResponse } from 'next/server';
import { orderRollbackService } from '@/lib/database/order-rollback';

/**
 * GET /api/orders/[id]/rollback-preview
 * ดึงข้อมูล Preview ก่อนทำ Rollback
 * แสดงผลกระทบที่จะเกิดขึ้นโดยไม่ execute จริง
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[rollback-preview] === START API REQUEST ===');
  
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    console.log('[rollback-preview] Parsed orderId:', orderId);

    if (isNaN(orderId)) {
      console.log('[rollback-preview] ERROR: Invalid order ID');
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('[rollback-preview] Calling orderRollbackService.getRollbackPreview...');
    const { data, error } = await orderRollbackService.getRollbackPreview(orderId);

    console.log('[rollback-preview] Service result:', { 
      hasData: !!data, 
      error,
      canRollback: data?.canRollback,
      blockingReason: data?.blockingReason
    });

    if (error) {
      console.log('[rollback-preview] Returning error response:', error);
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }

    console.log('[rollback-preview] === SUCCESS - Returning preview data ===');
    return NextResponse.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error('[rollback-preview] EXCEPTION:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

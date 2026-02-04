import { NextRequest, NextResponse } from 'next/server';
import { orderRollbackService } from '@/lib/database/order-rollback';
import { withAuth } from '@/lib/api/with-auth';
import { apiLog } from '@/lib/logging';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * POST /api/orders/[id]/rollback
 * Execute Partial Rollback Order กลับไปสถานะ Draft
 * 
 * Body:
 * - reason: string (required) - เหตุผลในการ Rollback
 */
async function handlePost(
  request: NextRequest,
  context: { params?: { id: string }; user: any }
) {
  const txId = await apiLog.start('ROLLBACK', request);
  console.log('[rollback] === START POST /api/orders/[id]/rollback ===');
  
  try {
    const { id } = await (context.params as any);
    const orderId = parseInt(id, 10);

    console.log('[rollback] Parsed orderId:', orderId);

    if (isNaN(orderId)) {
      console.log('[rollback] ERROR: Invalid order ID');
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    console.log('[rollback] Request body:', { reason });

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      console.log('[rollback] ERROR: Missing or invalid reason');
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการ Rollback' },
        { status: 400 }
      );
    }

    // Get user ID from auth context
    const userId = context.user.user_id;

    console.log('[rollback] User ID from auth context:', userId);

    // Get IP address and user agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    console.log('[rollback] Calling orderRollbackService.executeRollback...', {
      orderId,
      userId,
      reason: reason.trim(),
      ipAddress,
      userAgent
    });

    const { data, error } = await orderRollbackService.executeRollback({
      orderId,
      userId,
      reason: reason.trim(),
      ipAddress,
      userAgent
    });

    console.log('[rollback] Service result:', { 
      hasData: !!data, 
      error,
      success: data?.success,
      summary: data?.summary
    });

    if (error) {
      console.log('[rollback] Returning error response:', error);
      apiLog.failure(txId, 'ORDER_ROLLBACK_EXECUTE', new Error(error));
      return NextResponse.json(
        { error, data },
        { status: 400 }
      );
    }

    console.log('[rollback] === SUCCESS - Rollback completed ===');
    apiLog.success(txId, 'ORDER_ROLLBACK_EXECUTE', {
      entityType: 'ORDER',
      entityId: orderId.toString(),
      entityNo: data?.orderNo,
    });
    return NextResponse.json({
      success: true,
      message: 'Rollback Order สำเร็จ',
      data
    });
  } catch (err: any) {
    console.error('[rollback] EXCEPTION:', err);
    apiLog.failure(txId, 'ORDER_ROLLBACK_EXECUTE', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(withAuth(handlePost));

/**
 * GET /api/orders/[id]/rollback
 * ตรวจสอบว่า Order สามารถ Rollback ได้หรือไม่
 */
async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[rollback check] === START GET /api/orders/[id]/rollback ===');
  
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    console.log('[rollback check] Parsed orderId:', orderId);

    if (isNaN(orderId)) {
      console.log('[rollback check] ERROR: Invalid order ID');
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('[rollback check] Calling orderRollbackService.canRollback...');
    const result = await orderRollbackService.canRollback(orderId);

    console.log('[rollback check] Service result:', result);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error('[rollback check] EXCEPTION:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

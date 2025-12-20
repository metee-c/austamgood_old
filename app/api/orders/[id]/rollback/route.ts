import { NextRequest, NextResponse } from 'next/server';
import { orderRollbackService } from '@/lib/database/order-rollback';
import { getUserIdFromCookie } from '@/lib/database/user-context';

/**
 * POST /api/orders/[id]/rollback
 * Execute Partial Rollback Order กลับไปสถานะ Draft
 * 
 * Body:
 * - reason: string (required) - เหตุผลในการ Rollback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('[rollback] === START POST /api/orders/[id]/rollback ===');
  
  try {
    const { id } = await params;
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

    // Get user ID from cookie
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1;

    console.log('[rollback] User ID from cookie:', userId);

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
      return NextResponse.json(
        { error, data },
        { status: 400 }
      );
    }

    console.log('[rollback] === SUCCESS - Rollback completed ===');
    return NextResponse.json({
      success: true,
      message: 'Rollback Order สำเร็จ',
      data
    });
  } catch (err: any) {
    console.error('[rollback] EXCEPTION:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/rollback
 * ตรวจสอบว่า Order สามารถ Rollback ได้หรือไม่
 */
export async function GET(
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

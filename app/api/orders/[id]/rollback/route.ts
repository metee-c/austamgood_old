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
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการ Rollback' },
        { status: 400 }
      );
    }

    // Get user ID from cookie
    const cookieHeader = request.headers.get('cookie');
    const userId = await getUserIdFromCookie(cookieHeader) || 1;

    // Get IP address and user agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const { data, error } = await orderRollbackService.executeRollback({
      orderId,
      userId,
      reason: reason.trim(),
      ipAddress,
      userAgent
    });

    if (error) {
      return NextResponse.json(
        { error, data },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rollback Order สำเร็จ',
      data
    });
  } catch (err: any) {
    console.error('[rollback] Error:', err);
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
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const result = await orderRollbackService.canRollback(orderId);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    console.error('[rollback check] Error:', err);
    return NextResponse.json(
      { error: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

// API Route: Reject adjustment
// POST: Change status from pending_approval to rejected

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { cookies } from 'next/headers';
import { setUserContext } from '@/lib/supabase/with-user-context';
import { apiLog } from '@/lib/logging';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const txId = await apiLog.start('ADJUSTMENT', request);
  
  try {
    const supabase = await createClient();

    // Check authentication from session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');

    if (!sessionToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session and get user_id
    const { data: sessionData, error: sessionError } = await supabase.rpc(
      'validate_session_token',
      {
        p_token: sessionToken.value,
      }
    );

    if (
      sessionError ||
      !sessionData ||
      sessionData.length === 0 ||
      !sessionData[0].is_valid
    ) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = sessionData[0].user_id;

    // Set user context for audit trail
    await setUserContext(supabase);

    const { id } = await params;
    const adjustmentId = parseInt(id);
    if (isNaN(adjustmentId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Reject adjustment
    const { data: adjustment, error } =
      await stockAdjustmentService.rejectAdjustment(adjustmentId, userId, reason);

    if (error) {
      apiLog.failure(txId, 'STOCK_ADJUST_REJECT', new Error(error));
      return NextResponse.json({ error }, { status: 400 });
    }

    apiLog.success(txId, 'STOCK_ADJUST_REJECT', {
      entityType: 'ADJUSTMENT',
      entityId: adjustmentId.toString(),
    });
    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error rejecting stock adjustment:', error);
    apiLog.failure(txId, 'STOCK_ADJUST_REJECT', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

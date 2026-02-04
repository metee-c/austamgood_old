// API Route: Complete adjustment (records to ledger and updates balances)
// POST: Change status from approved to completed

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { cookies } from 'next/headers';
import { setUserContext } from '@/lib/supabase/with-user-context';
import { apiLog } from '@/lib/logging';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _POST(
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

    // Complete adjustment (records to ledger and updates balances)
    const { data: adjustment, error } =
      await stockAdjustmentService.completeAdjustment(adjustmentId, userId);

    if (error) {
      apiLog.failure(txId, 'STOCK_ADJUST_COMPLETE', new Error(error));
      return NextResponse.json({ error }, { status: 400 });
    }

    apiLog.success(txId, 'STOCK_ADJUST_COMPLETE', {
      entityType: 'ADJUSTMENT',
      entityId: adjustmentId.toString(),
    });
    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error completing stock adjustment:', error);
    apiLog.failure(txId, 'STOCK_ADJUST_COMPLETE', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);

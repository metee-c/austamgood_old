// API Route: Submit adjustment for approval
// POST: Change status from draft to pending_approval

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { cookies } from 'next/headers';
import { setUserContext } from '@/lib/supabase/with-user-context';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Submit for approval
    const { data: adjustment, error } =
      await stockAdjustmentService.submitForApproval(adjustmentId, userId);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error submitting stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

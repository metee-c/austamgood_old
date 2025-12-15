// API Route: Cancel adjustment
// POST: Change status to cancelled (allowed for draft, pending_approval, approved)

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const adjustmentId = parseInt(id);
    if (isNaN(adjustmentId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Get user_id from system_users table
    const { data: systemUser } = await supabase
      .from('system_users')
      .select('user_id')
      .eq('email', user.email)
      .single();

    if (!systemUser) {
      return NextResponse.json(
        { error: 'System user not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      );
    }

    // Cancel adjustment
    const { data: adjustment, error } = await stockAdjustmentService.cancelAdjustment(
      adjustmentId,
      systemUser.user_id,
      reason
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error cancelling stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

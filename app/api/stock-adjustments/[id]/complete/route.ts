// API Route: Complete adjustment (records to ledger and updates balances)
// POST: Change status from approved to completed

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

    // Complete adjustment (records to ledger and updates balances)
    const { data: adjustment, error } = await stockAdjustmentService.completeAdjustment(
      adjustmentId,
      systemUser.user_id
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error completing stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

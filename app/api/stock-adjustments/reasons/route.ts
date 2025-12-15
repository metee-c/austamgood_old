// API Route: Get adjustment reasons
// GET: List all adjustment reasons (optionally filter by active status)

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // Default true

    // Fetch reasons
    const { data: reasons, error } = await stockAdjustmentService.getAdjustmentReasons(activeOnly);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: reasons });
  } catch (error: any) {
    console.error('Error fetching adjustment reasons:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

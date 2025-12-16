// API Routes for Stock Adjustments
// GET: List adjustments with filters
// POST: Create new adjustment

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { createAdjustmentSchema } from '@/types/stock-adjustment-schema';
import type { AdjustmentFilters } from '@/types/stock-adjustment-schema';
import { cookies } from 'next/headers';
import { setUserContext } from '@/lib/supabase/with-user-context';

export const dynamic = 'force-dynamic';

// GET: List adjustments with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication from session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');
    
    if (!sessionToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session
    const { data: sessionData, error: sessionError } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken.value
    });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Set user context for audit trail
    await setUserContext(supabase);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const rawFilters: any = {
      adjustment_type: searchParams.get('adjustment_type') || undefined,
      status: searchParams.get('status') || undefined,
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      reason_id: searchParams.get('reason_id')
        ? parseInt(searchParams.get('reason_id')!)
        : undefined,
      created_by: searchParams.get('created_by')
        ? parseInt(searchParams.get('created_by')!)
        : undefined,
      searchTerm: searchParams.get('searchTerm') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!)
        : 0,
    };

    // Remove undefined values
    const filters = Object.fromEntries(
      Object.entries(rawFilters).filter(([_, v]) => v !== undefined)
    ) as AdjustmentFilters;

    // Fetch adjustments
    const { data: adjustments, error } = await stockAdjustmentService.getAdjustments(filters);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: adjustments });
  } catch (error: any) {
    console.error('Error fetching stock adjustments:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new adjustment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication from session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');
    
    console.log('[Stock Adjustment API] Session token exists:', !!sessionToken);
    
    if (!sessionToken?.value) {
      console.log('[Stock Adjustment API] No session token found');
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 });
    }

    // Validate session and get user_id
    const { data: sessionData, error: sessionError } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken.value
    });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      console.log('[Stock Adjustment API] Invalid session');
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = sessionData[0].user_id;
    console.log('[Stock Adjustment API] User ID from session:', userId);

    // Set user context for audit trail
    await setUserContext(supabase);

    // Parse request body
    const body = await request.json();

    // Validate payload
    const validation = createAdjustmentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Add created_by from session if not provided
    const payloadWithUser = {
      ...validation.data,
      created_by: validation.data.created_by || userId,
    };

    // Create adjustment
    console.log('[Stock Adjustment API] Creating adjustment with payload:', JSON.stringify(payloadWithUser, null, 2));
    const { data: adjustment, error } = await stockAdjustmentService.createAdjustment(payloadWithUser);

    if (error) {
      console.log('[Stock Adjustment API] Service error:', error);
      return NextResponse.json({ error }, { status: 400 });
    }

    console.log('[Stock Adjustment API] Successfully created adjustment:', adjustment?.adjustment_id);
    return NextResponse.json({ data: adjustment }, { status: 201 });
  } catch (error: any) {
    console.error('[Stock Adjustment API] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// API Routes for Stock Adjustments
// GET: List adjustments with filters
// POST: Create new adjustment

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { createAdjustmentSchema } from '@/types/stock-adjustment-schema';
import type { AdjustmentFilters } from '@/types/stock-adjustment-schema';

export const dynamic = 'force-dynamic';

// GET: List adjustments with optional filters
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

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Create adjustment
    const { data: adjustment, error } = await stockAdjustmentService.createAdjustment(validation.data);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ data: adjustment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

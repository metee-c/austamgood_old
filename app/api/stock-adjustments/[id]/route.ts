// API Routes for Individual Stock Adjustment
// GET: Get adjustment by ID
// PATCH: Update adjustment (draft only)
// DELETE: Delete adjustment (draft only)

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import {
  updateAdjustmentSchema,
  type UpdateAdjustmentPayload,
} from '@/types/stock-adjustment-schema';

export const dynamic = 'force-dynamic';

// GET: Get adjustment by ID
export async function GET(
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

    // Fetch adjustment
    const { data: adjustment, error } = await stockAdjustmentService.getAdjustmentById(adjustmentId);

    if (error || !adjustment) {
      return NextResponse.json(
        { error: error || 'Adjustment not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error fetching stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update adjustment (draft only)
export async function PATCH(
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

    // Parse request body
    const body = await request.json();

    // Validate payload
    const validation = updateAdjustmentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.errors },
        { status: 400 }
      );
    }

    const payload: UpdateAdjustmentPayload = validation.data;

    // Update adjustment
    const { data: adjustment, error } = await stockAdjustmentService.updateAdjustment(adjustmentId, payload);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ data: adjustment });
  } catch (error: any) {
    console.error('Error updating stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete adjustment (draft only)
export async function DELETE(
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

    // Delete adjustment (will cascade delete items)
    const { data, error } = await supabase
      .from('wms_stock_adjustments')
      .delete()
      .eq('adjustment_id', adjustmentId)
      .eq('status', 'draft') // Only allow deleting drafts
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Adjustment not found or cannot be deleted (only drafts can be deleted)' },
          { status: 404 }
        );
      }
      throw error;
    }
    return NextResponse.json({ success: true, deleted: data });
  } catch (error: any) {
    console.error('Error deleting stock adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// API Route: Check stock availability for adjustment
// POST: Check if stock can be adjusted (used for validation before creating decrease adjustment)

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkAvailabilitySchema = z.object({
  warehouse_id: z.string().min(1),
  location_id: z.string().min(1),
  sku_id: z.string().min(1),
  pallet_id: z.string().nullable().optional(),
  adjustment_piece_qty: z.number().int(),
});

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

    // Parse and validate request body
    const body = await request.json();
    const validation = checkAvailabilitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { warehouse_id, location_id, sku_id, pallet_id, adjustment_piece_qty } = validation.data;

    // Check availability using validateReservedStock
    const { data, error } = await stockAdjustmentService.validateReservedStock(
      warehouse_id,
      [{
        sku_id,
        location_id,
        pallet_id: pallet_id || null,
        adjustment_piece_qty,
      }]
    );

    if (error) {
      return NextResponse.json({ available: false, error }, { status: 200 });
    }

    return NextResponse.json({ available: true, data });
  } catch (error: any) {
    console.error('Error checking stock availability:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

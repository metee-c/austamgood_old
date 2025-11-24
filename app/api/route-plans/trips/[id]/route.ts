import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: tripId } = await params;
    const body = await request.json();

    // Prepare update object with base fields
    const updateData: any = {
      shipping_cost: body.shipping_cost,
      notes: body.notes,
      updated_at: new Date().toISOString()
    };

    // Add pricing mode fields if provided
    if (body.pricing_mode) {
      updateData.pricing_mode = body.pricing_mode;
    }

    // Add supplier_id if provided
    if (body.supplier_id !== undefined) {
      updateData.supplier_id = body.supplier_id;
    }

    // Add formula-specific fields if in formula mode
    if (body.pricing_mode === 'formula') {
      if (body.base_price !== undefined) updateData.base_price = body.base_price;
      if (body.helper_fee !== undefined) updateData.helper_fee = body.helper_fee;
      if (body.extra_stop_fee !== undefined) updateData.extra_stop_fee = body.extra_stop_fee;
      if (body.porterage_fee !== undefined) updateData.porterage_fee = body.porterage_fee;
      if (body.other_fees !== undefined) updateData.other_fees = body.other_fees;
      // Add total_stops to trigger the database trigger for extra_stops_count calculation
      if (body.total_stops !== undefined) updateData.total_stops = body.total_stops;
    }

    // In formula mode, let the database trigger calculate shipping_cost
    // by removing the manual shipping_cost override
    if (body.pricing_mode === 'formula') {
      delete updateData.shipping_cost;
    }

    // Update trip with shipping cost and other details
    const { data, error } = await supabase
      .from('receiving_route_trips')
      .update(updateData)
      .eq('trip_id', tripId)
      .select()
      .single();

    if (error) {
      console.error('Error updating trip:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error updating trip:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

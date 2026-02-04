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

    // Add vehicle_id and driver_id if provided
    if (body.vehicle_id !== undefined) {
      updateData.vehicle_id = body.vehicle_id;
    }
    if (body.driver_id !== undefined) {
      updateData.driver_id = body.driver_id;
    }

    // Add formula-specific fields if in formula mode
    if (body.pricing_mode === 'formula') {
      if (body.base_price !== undefined) updateData.base_price = body.base_price;
      if (body.helper_fee !== undefined) updateData.helper_fee = body.helper_fee;
      if (body.extra_stop_fee !== undefined) updateData.extra_stop_fee = body.extra_stop_fee;
      // Add total_stops to trigger the database trigger for extra_stops_count calculation
      if (body.total_stops !== undefined) updateData.total_stops = body.total_stops;
    } else if (body.pricing_mode === 'flat') {
      // For flat mode, use base_shipping_cost to store the base flat rate
      // The trigger will calculate shipping_cost = base_shipping_cost + porterage_fee + other_fees + extra_delivery_stops
      if (body.shipping_cost !== undefined) {
        updateData.base_shipping_cost = body.shipping_cost;
      }
    }

    // porterage_fee and other_fees should be saved regardless of pricing mode
    if (body.porterage_fee !== undefined) updateData.porterage_fee = body.porterage_fee;
    if (body.other_fees !== undefined) updateData.other_fees = body.other_fees;

    // Add extra_delivery_stops if provided (จุดส่งพิเศษที่ไม่มี order)
    if (body.extra_delivery_stops !== undefined) updateData.extra_delivery_stops = body.extra_delivery_stops;

    // Add actual_stops_count if provided (กรณีหลายร้านส่งที่เดียวกัน)
    if (body.actual_stops_count !== undefined) updateData.actual_stops_count = body.actual_stops_count;

    // Handle shipping cost reset fields (from rollback)
    if (body.needs_shipping_cost_update !== undefined) {
      updateData.needs_shipping_cost_update = body.needs_shipping_cost_update;
    }
    if (body.shipping_cost_reset_reason !== undefined) {
      updateData.shipping_cost_reset_reason = body.shipping_cost_reset_reason;
    }
    if (body.shipping_cost_reset_at !== undefined) {
      updateData.shipping_cost_reset_at = body.shipping_cost_reset_at;
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

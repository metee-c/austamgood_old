import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an array of inputs', data: null },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate required fields for each input
    const validatedInputs = body.map(input => ({
      plan_id: input.plan_id,
      order_id: input.order_id,
      stop_name: input.stop_name || null,
      contact_phone: input.contact_phone || null,
      address: input.address || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      priority: input.priority || 50,
      service_duration_minutes: input.service_duration_minutes || 15,
      ready_time: input.ready_time || null,
      due_time: input.due_time || null,
      is_active: input.is_active !== undefined ? input.is_active : true,
      demand_weight_kg: input.demand_weight_kg || 0,
      demand_units: input.demand_units || 1,
      tags: input.tags || null
    }));

    const { data, error } = await supabase
      .from('receiving_route_plan_inputs')
      .insert(validatedInputs)
      .select();

    if (error) {
      console.error('Error inserting route plan inputs:', error);
      return NextResponse.json(
        { error: error.message, data: null },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    console.error('Error in route plan inputs API:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const picklistId = (await params).id;

    const { data: picklist, error } = await supabase
      .from('picklists')
      .select(`
        *,
        receiving_route_trips (
          trip_id,
          trip_sequence,
          vehicle_id,
          receiving_route_plans (
            plan_id,
            plan_code,
            plan_name
          )
        )
      `)
      .eq('id', picklistId)
      .single();

    if (error) {
      console.error('Error fetching picklist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!picklist) {
      return NextResponse.json({ error: 'Picklist not found' }, { status: 404 });
    }

    return NextResponse.json(picklist);
  } catch (error: any) {
    console.error('Error in GET /api/picklists/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const picklistId = (await params).id;
    const body = await request.json();

    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'assigned', 'picking', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('picklists')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', picklistId)
      .select()
      .single();

    if (error) {
      console.error('Error updating picklist status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in PATCH /api/picklists/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

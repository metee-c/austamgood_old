import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/replenishment/[id]
 * Get single replenishment task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('replenishment_queue')
      .select(`
        *,
        master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack),
        from_location:from_location_id (location_id, zone, location_type),
        to_location:to_location_id (location_id, zone, location_type),
        assigned_employee:assigned_to (employee_id, first_name, last_name, nickname)
      `)
      .eq('queue_id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


/**
 * PATCH /api/replenishment/[id]
 * Update replenishment task (assign, start, complete, cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    };

    // Handle status transitions
    if (body.status === 'assigned' && body.assigned_to) {
      updateData.assigned_at = new Date().toISOString();
    }
    if (body.status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    }
    if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('replenishment_queue')
      .update(updateData)
      .eq('queue_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating replenishment task:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in PATCH /api/replenishment/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/replenishment/[id]
 * Delete/cancel replenishment task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { error } = await supabase
      .from('replenishment_queue')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('queue_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/replenishment
 * Fetch replenishment queue with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const warehouseId = searchParams.get('warehouse_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('replenishment_queue')
      .select(`
        *,
        master_sku:sku_id (
          sku_id,
          sku_name,
          uom_base,
          qty_per_pack
        ),
        from_location:from_location_id (
          location_id,
          zone,
          location_type
        ),
        to_location:to_location_id (
          location_id,
          zone,
          location_type
        ),
        assigned_employee:assigned_to (
          employee_id,
          first_name,
          last_name,
          nickname
        )
      `)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching replenishment queue:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in GET /api/replenishment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/replenishment
 * Create a new replenishment task
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('replenishment_queue')
      .insert({
        ...body,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating replenishment task:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in POST /api/replenishment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

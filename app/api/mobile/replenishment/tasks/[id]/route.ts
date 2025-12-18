import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/replenishment/tasks/[id]
 * Get single replenishment task with full details
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
        master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack, qty_per_pallet),
        from_location:from_location_id (location_id, location_code, location_name, zone),
        to_location:to_location_id (location_id, location_code, location_name, zone),
        assigned_user:assigned_to (user_id, username, full_name)
      `)
      .eq('queue_id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

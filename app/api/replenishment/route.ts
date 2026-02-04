import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canTransferToLocation } from '@/lib/database/prep-area-validation';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

/**
 * GET /api/replenishment
 * Fetch replenishment queue with filters
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว
    
    const status = searchParams.get('status');
    const warehouseId = searchParams.get('warehouse_id');
    const triggerSource = searchParams.get('trigger_source');
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
        assigned_user:assigned_to (
          user_id,
          username,
          full_name
        )
      `)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    // Filter by trigger_source (e.g., 'production_order' for material requisition)
    if (triggerSource) {
      query = query.eq('trigger_source', triggerSource);
    }

    // Apply pagination
    query = query;

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching replenishment queue:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      data
    });
  } catch (error: any) {
    console.error('Error in GET /api/replenishment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/replenishment
 * Create a new replenishment task
 */
async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    // Validate SKU can be transferred to destination Prep Area
    if (body.sku_id && body.to_location_id) {
      const transferCheck = await canTransferToLocation(supabase, body.sku_id, body.to_location_id);
      if (!transferCheck.allowed) {
        return NextResponse.json({ 
          error: transferCheck.message,
          error_code: 'INVALID_PREP_AREA'
        }, { status: 400 });
      }
    }

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

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);

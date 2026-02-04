import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

/**
 * Helper function to check if all materials are issued and update production order status
 */
async function checkAndUpdateProductionOrderStatus(supabase: any, productionOrderId: string) {
  try {
    // Get all packaging items for this production order
    const { data: items, error: itemsError } = await supabase
      .from('production_order_items')
      .select('id, status, required_qty, issued_qty')
      .eq('production_order_id', productionOrderId);

    if (itemsError) {
      console.log('📦 [Status Check] Error fetching items:', itemsError);
      return;
    }

    // Check replenishment_queue for food materials
    const { data: replenishmentItems, error: replenishmentError } = await supabase
      .from('replenishment_queue')
      .select('id, status, requested_qty, confirmed_qty')
      .eq('trigger_reference', productionOrderId);

    // Check if all packaging items are issued
    const allPackagingIssued = !items || items.length === 0 || items.every(
      (item: any) => item.status === 'issued' || item.status === 'completed'
    );

    // Check if all food materials are completed (from replenishment_queue)
    const allFoodCompleted = !replenishmentItems || replenishmentItems.length === 0 || 
      replenishmentItems.every((item: any) => item.status === 'completed');

    console.log('📦 [Status Check] Packaging issued:', allPackagingIssued, 'Food completed:', allFoodCompleted);

    // If all materials are ready, update production order status to 'in_progress'
    if (allPackagingIssued && allFoodCompleted) {
      const { error: updateError } = await supabase
        .from('production_orders')
        .update({
          status: 'in_progress',
          actual_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productionOrderId)
        .in('status', ['planned', 'released']); // Only update if not already in_progress or completed

      if (updateError) {
        console.error('📦 [Status Check] Error updating production order status:', updateError);
      } else {
        console.log('📦 [Status Check] Production order status updated to in_progress');
      }
    }
  } catch (error) {
    console.error('📦 [Status Check] Error in checkAndUpdateProductionOrderStatus:', error);
  }
}

/**
 * GET /api/replenishment/[id]
 * Get single replenishment task
 */
async function _GET(
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
        from_location:from_location_id (location_id, location_code, location_name, zone, location_type),
        to_location:to_location_id (location_id, location_code, location_name, zone, location_type),
        assigned_user:assigned_to (user_id, username, full_name)
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
async function _PATCH(
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

    // If task is completed, check if all materials are ready and update production order status
    if (body.status === 'completed' && data?.trigger_reference) {
      await checkAndUpdateProductionOrderStatus(supabase, data.trigger_reference);
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
async function _DELETE(
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

export const GET = withShadowLog(_GET);
export const PATCH = withShadowLog(_PATCH);
export const DELETE = withShadowLog(_DELETE);

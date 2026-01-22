import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserFromCookie } from '@/lib/auth/simple-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/replenishment/tasks
 * ดึงรายการงานเติมสต็อกที่มอบหมายให้ผู้ใช้ที่ login อยู่
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || 'all';
    const triggerSource = searchParams.get('trigger_source') || null;
    const showAll = searchParams.get('show_all') === 'true'; // Show all tasks, not just assigned to current user

    // Get current user from JWT token
    const userResult = await getCurrentUserFromCookie();
    
    console.log('[Replenishment Tasks] User result:', { 
      success: userResult.success, 
      hasUser: !!userResult.user,
      error: userResult.error 
    });
    
    if (!userResult.success || !userResult.user) {
      console.error('[Replenishment Tasks] Auth failed:', userResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = userResult.user.user_id;

    if (!currentUserId) {
      console.error('[Replenishment Tasks] No user_id found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Replenishment Tasks] Authenticated user:', currentUserId);

    let query = supabase
      .from('replenishment_queue')
      .select(`
        *,
        master_sku:sku_id (
          sku_id,
          sku_name,
          uom_base,
          qty_per_pack,
          qty_per_pallet
        ),
        from_location:from_location_id (
          location_id,
          location_code,
          location_name,
          zone,
          location_type
        ),
        to_location:to_location_id (
          location_id,
          location_code,
          location_name,
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

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Default: show pending, assigned, in_progress (not completed/cancelled)
      query = query.in('status', ['pending', 'assigned', 'in_progress']);
    }

    // Filter by trigger_source if specified
    if (triggerSource) {
      query = query.eq('trigger_source', triggerSource);
    } else {
      // If no trigger_source specified, exclude production_order tasks
      // Production order tasks should only appear in the "เติมวัตถุดิบ" tab
      query = query.or('trigger_source.is.null,trigger_source.neq.production_order');
    }

    // Filter by assigned user - show only tasks assigned to current user (unless show_all is true)
    if (!showAll) {
      query = query.eq('assigned_to', currentUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching replenishment tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match expected format for mobile
    const tasks = (data || []).map((task) => ({
      ...task,
      // Add computed fields for compatibility
      alert_id: task.queue_id,
      sku_name: task.master_sku?.sku_name || task.sku_id,
      sku_code: task.sku_id,
      uom_base: task.master_sku?.uom_base || 'ชิ้น',
      qty_per_pallet: task.master_sku?.qty_per_pallet || 1,
      pick_location_code: task.to_location?.location_code || task.to_location_id,
      pick_location_name: task.to_location?.location_name || '',
      from_location_code: task.from_location?.location_code || task.from_location_id,
      from_location_name: task.from_location?.location_name || '',
      shortage_qty: task.requested_qty,
      pallets_needed: Math.ceil(task.requested_qty / (task.master_sku?.qty_per_pallet || 1)),
      current_qty: 0,
      required_qty: task.requested_qty,
      alert_reason: task.trigger_source || 'replenishment',
      // FEFO: Include pallet_id and expiry_date
      pallet_id: task.pallet_id || null,
      expiry_date: task.expiry_date || null,
      suggested_sources: task.from_location ? [{
        location_id: task.from_location.location_id,
        location_code: task.from_location.location_code,
        available_qty: task.requested_qty,
        pallet_id: task.pallet_id || null
      }] : []
    }));

    return NextResponse.json({
      success: true,
      data: tasks,
      total: tasks.length
    });
  } catch (error: any) {
    console.error('Error in GET /api/mobile/replenishment/tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stock-health
 * Returns stock system health summary for monitoring
 */
async function _GET() {
  try {
    const supabase = await createClient();

    const checks = {
      timestamp: new Date().toISOString(),
      negative_balances: 0,
      over_reserved: 0,
      orphan_reservations: 0,
      ledger_mismatches: 0,
      total_balance_records: 0,
      total_pieces: 0,
      status: 'healthy' as 'healthy' | 'warning' | 'critical',
      issues: [] as string[],
    };

    // Check negative balances
    const { count: negCount } = await supabase
      .from('wms_inventory_balances')
      .select('*', { count: 'exact', head: true })
      .lt('total_piece_qty', 0);
    checks.negative_balances = negCount || 0;

    // Check over-reserved (positive balances only)
    const { data: overResData } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id')
      .gte('total_piece_qty', 0)
      .gt('reserved_piece_qty', 0);
    
    // Filter in JS since Supabase doesn't support column comparison directly
    const { data: allBalances } = await supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty, reserved_piece_qty')
      .gte('total_piece_qty', 0);
    
    checks.over_reserved = allBalances?.filter(
      b => Number(b.reserved_piece_qty) > Number(b.total_piece_qty)
    ).length || 0;

    // Check orphan reservations
    const { data: orphanData } = await supabase
      .from('picklist_item_reservations')
      .select('reservation_id, picklist_items!inner(id)')
      .is('picklist_items.id', null);
    checks.orphan_reservations = orphanData?.length || 0;

    // Get totals
    const { count: totalRecords } = await supabase
      .from('wms_inventory_balances')
      .select('*', { count: 'exact', head: true });
    checks.total_balance_records = totalRecords || 0;

    const { data: sumData } = await supabase
      .from('wms_inventory_balances')
      .select('total_piece_qty');
    checks.total_pieces = sumData?.reduce(
      (sum, row) => sum + Number(row.total_piece_qty || 0), 0
    ) || 0;

    // Determine overall status
    if (checks.over_reserved > 0 || checks.orphan_reservations > 0) {
      checks.status = 'critical';
      if (checks.over_reserved > 0) {
        checks.issues.push(`${checks.over_reserved} over-reserved items`);
      }
      if (checks.orphan_reservations > 0) {
        checks.issues.push(`${checks.orphan_reservations} orphan reservations`);
      }
    } else if (checks.negative_balances > 10) {
      checks.status = 'warning';
      checks.issues.push(`${checks.negative_balances} negative balances`);
    }

    return NextResponse.json(checks);
  } catch (error) {
    console.error('Stock health check error:', error);
    return NextResponse.json(
      { error: 'Failed to check stock health' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

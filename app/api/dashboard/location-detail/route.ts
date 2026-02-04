// ============================================================================
// API Route: Location Detail for Dashboard
// GET /api/dashboard/location-detail?location_id=xxx
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const locationId = searchParams.get('location_id');

    if (!locationId) {
      return NextResponse.json(
        { data: null, error: 'location_id is required' },
        { status: 400 }
      );
    }

    // 1. Get location info
    const { data: location, error: locError } = await supabase
      .from('master_location')
      .select('*')
      .eq('location_id', locationId)
      .single();

    if (locError) throw locError;

    // 2. Get inventory items in this location
    const { data: items, error: itemsError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        sku_id,
        pallet_id,
        pallet_id_external,
        lot_no,
        production_date,
        expiry_date,
        total_pack_qty,
        total_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        last_movement_at,
        master_sku (
          sku_id,
          sku_name,
          weight_per_piece_kg
        )
      `)
      .eq('location_id', locationId)
      .gt('total_piece_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('production_date', { ascending: true });

    if (itemsError) throw itemsError;

    // 3. Calculate aggregates
    const itemsData = (items || []).map((item: any) => ({
      balance_id: item.balance_id,
      sku_id: item.sku_id,
      sku_name: item.master_sku?.sku_name || item.sku_id,
      pallet_id: item.pallet_id || item.pallet_id_external,
      lot_no: item.lot_no,
      production_date: item.production_date,
      expiry_date: item.expiry_date,
      total_pack_qty: item.total_pack_qty,
      total_piece_qty: item.total_piece_qty,
      reserved_pack_qty: item.reserved_pack_qty,
      reserved_piece_qty: item.reserved_piece_qty,
      last_movement_at: item.last_movement_at,
    }));

    const skuCount = itemsData.length;
    const totalPieceQty = itemsData.reduce((sum, item) => sum + item.total_piece_qty, 0);
    const reservedPieceQty = itemsData.reduce((sum, item) => sum + item.reserved_piece_qty, 0);

    const utilization = location.max_capacity_qty > 0
      ? Math.min(100, ((location.current_qty || 0) / location.max_capacity_qty) * 100)
      : 0;

    return NextResponse.json({
      data: {
        ...location,
        sku_count: skuCount,
        total_pack_qty: itemsData.reduce((sum, item) => sum + item.total_pack_qty, 0),
        total_piece_qty: totalPieceQty,
        reserved_pack_qty: itemsData.reduce((sum, item) => sum + item.reserved_pack_qty, 0),
        reserved_piece_qty: reservedPieceQty,
        utilization_percent: Math.round(utilization),
        is_empty: skuCount === 0,
        is_full: utilization >= 95,
        has_reserved: reservedPieceQty > 0,
        items: itemsData,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Location detail API error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

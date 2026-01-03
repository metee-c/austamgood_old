// ============================================================================
// API Route: Warehouse Dashboard Map Data
// GET /api/dashboard/warehouse-map - ดึงข้อมูล Location + Inventory สำหรับ Dashboard
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';

    // 1. ดึงข้อมูล Warehouse
    const { data: warehouse, error: whError } = await supabase
      .from('master_warehouse')
      .select('warehouse_id, warehouse_name')
      .eq('warehouse_id', warehouseId)
      .single();

    if (whError) throw whError;

    // 2. ดึงข้อมูล Location ทั้งหมด (ยกเว้น Dispatch, Delivery, Preparation Area)
    const { data: locations, error: locError } = await supabase
      .from('master_location')
      .select(`
        location_id,
        location_code,
        location_name,
        location_type,
        zone,
        aisle,
        rack,
        shelf,
        bin,
        active_status,
        max_capacity_qty,
        current_qty
      `)
      .eq('warehouse_id', warehouseId)
      .eq('active_status', 'active')
      .not('location_id', 'in', '(Dispatch,Delivery-In-Progress)')
      .not('location_code', 'like', 'PK%')
      .order('location_code');

    if (locError) throw locError;

    // 3. ดึงข้อมูล Inventory summary per location
    const { data: inventorySummary, error: invError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        location_id,
        sku_id,
        total_pack_qty,
        total_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty
      `)
      .eq('warehouse_id', warehouseId)
      .gt('total_piece_qty', 0);

    if (invError) throw invError;

    // 4. Aggregate inventory data per location
    const inventoryMap = new Map<string, any>();

    if (inventorySummary) {
      inventorySummary.forEach((inv) => {
        const existing = inventoryMap.get(inv.location_id) || {
          sku_count: 0,
          total_pack_qty: 0,
          total_piece_qty: 0,
          reserved_pack_qty: 0,
          reserved_piece_qty: 0,
        };

        inventoryMap.set(inv.location_id, {
          sku_count: existing.sku_count + 1,
          total_pack_qty: existing.total_pack_qty + (inv.total_pack_qty || 0),
          total_piece_qty: existing.total_piece_qty + (inv.total_piece_qty || 0),
          reserved_pack_qty: existing.reserved_pack_qty + (inv.reserved_pack_qty || 0),
          reserved_piece_qty: existing.reserved_piece_qty + (inv.reserved_piece_qty || 0),
        });
      });
    }

    // 5. Merge location + inventory data
    const enrichedLocations = (locations || []).map((loc) => {
      const inv = inventoryMap.get(loc.location_id) || {
        sku_count: 0,
        total_pack_qty: 0,
        total_piece_qty: 0,
        reserved_pack_qty: 0,
        reserved_piece_qty: 0,
      };

      const utilization = loc.max_capacity_qty > 0
        ? Math.min(100, ((loc.current_qty || 0) / loc.max_capacity_qty) * 100)
        : 0;

      return {
        ...loc,
        ...inv,
        utilization_percent: Math.round(utilization),
        is_empty: inv.sku_count === 0,
        is_full: utilization >= 95,
        has_reserved: inv.reserved_piece_qty > 0,
      };
    });

    // 6. Group by zone
    const zoneMap = new Map<string, any>();

    enrichedLocations.forEach((loc) => {
      const zoneName = loc.zone || 'Other';

      if (!zoneMap.has(zoneName)) {
        zoneMap.set(zoneName, {
          zone_name: zoneName,
          zone_type: getZoneType(zoneName),
          locations: [],
          total_locations: 0,
          occupied_locations: 0,
          total_sku_count: 0,
          total_qty: 0,
        });
      }

      const zone = zoneMap.get(zoneName);
      zone.locations.push(loc);
      zone.total_locations++;
      if (!loc.is_empty) zone.occupied_locations++;
      zone.total_sku_count += loc.sku_count;
      zone.total_qty += loc.total_piece_qty;
    });

    // Calculate zone utilization
    const zones = Array.from(zoneMap.values()).map((zone) => ({
      ...zone,
      utilization_percent: zone.total_locations > 0
        ? Math.round((zone.occupied_locations / zone.total_locations) * 100)
        : 0,
    }));

    // 7. Calculate totals
    const totalLocations = enrichedLocations.length;
    const occupiedLocations = enrichedLocations.filter((loc) => !loc.is_empty).length;
    const totalSkuCount = enrichedLocations.reduce((sum, loc) => sum + loc.sku_count, 0);
    const totalQty = enrichedLocations.reduce((sum, loc) => sum + loc.total_piece_qty, 0);

    return NextResponse.json({
      data: {
        warehouse_id: warehouse.warehouse_id,
        warehouse_name: warehouse.warehouse_name,
        zones,
        total_locations: totalLocations,
        occupied_locations: occupiedLocations,
        total_sku_count: totalSkuCount,
        total_qty: totalQty,
        last_updated: new Date().toISOString(),
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Warehouse map API error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

function getZoneType(zoneName: string): string {
  if (zoneName.includes('Selective Rack')) return 'selective_rack';
  if (zoneName.includes('Block Stack')) return 'blk_storage';
  if (zoneName.includes('Picking')) return 'picking';
  if (zoneName.includes('Dock')) return 'dock';
  return 'other';
}

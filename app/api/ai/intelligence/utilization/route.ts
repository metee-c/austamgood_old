/**
 * Intelligence API: Utilization
 * GET /api/ai/intelligence/utilization
 *
 * Returns warehouse and location utilization metrics
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, LocationUtilization, WarehouseUtilization } from '@/lib/intelligence/types';
import {
  calculateLocationUtilization,
  calculateWarehouseUtilization,
  calculateUtilizationSummary,
} from '@/lib/intelligence/utilization-engine';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const warehouse_id = searchParams.get('warehouse_id');
    const zone = searchParams.get('zone');
    const view = searchParams.get('view') || 'summary'; // summary, locations, warehouse

    // Get location data with capacity
    let locationQuery = supabase
      .from('master_location')
      .select('location_id, location_code, warehouse_id, zone, max_capacity_qty, current_qty');

    if (warehouse_id) locationQuery = locationQuery.eq('warehouse_id', warehouse_id);
    if (zone) locationQuery = locationQuery.eq('zone', zone);

    const { data: locationData, error: locationError } = await locationQuery;

    if (locationError) {
      return NextResponse.json({ success: false, error: locationError.message }, { status: 500 });
    }

    // Get warehouse names
    const warehouseIds = [...new Set(locationData?.map((l) => l.warehouse_id) || [])];
    const { data: warehouseData } = await supabase
      .from('master_warehouse')
      .select('warehouse_id, warehouse_name')
      .in('warehouse_id', warehouseIds.length > 0 ? warehouseIds : ['']);

    const warehouseNameMap = new Map(warehouseData?.map((w) => [w.warehouse_id, w.warehouse_name]) || []);

    // Calculate location utilization
    const locationUtilizations: LocationUtilization[] = (locationData || []).map((loc) =>
      calculateLocationUtilization({
        location_id: loc.location_id,
        location_code: loc.location_code,
        zone: loc.zone || 'Unknown',
        max_capacity: Number(loc.max_capacity_qty || 0),
        current_qty: Number(loc.current_qty || 0),
      })
    );

    // Calculate warehouse utilization
    const warehouseMap = new Map<string, typeof locationData>();
    locationData?.forEach((loc) => {
      const existing = warehouseMap.get(loc.warehouse_id) || [];
      existing.push(loc);
      warehouseMap.set(loc.warehouse_id, existing);
    });

    const warehouseUtilizations: WarehouseUtilization[] = Array.from(warehouseMap.entries()).map(
      ([wh_id, locations]) =>
        calculateWarehouseUtilization({
          warehouse_id: wh_id,
          warehouse_name: warehouseNameMap.get(wh_id) || wh_id,
          locations: locations.map((l) => ({
            location_id: l.location_id,
            zone: l.zone || 'Unknown',
            max_capacity: Number(l.max_capacity_qty || 0),
            current_qty: Number(l.current_qty || 0),
          })),
        })
    );

    // Calculate summary
    const summary = calculateUtilizationSummary(locationUtilizations);

    // Build response based on view
    let responseData: any;

    switch (view) {
      case 'locations':
        responseData = {
          locations: locationUtilizations.sort((a, b) => b.utilization_percent - a.utilization_percent),
          summary,
        };
        break;
      case 'warehouse':
        responseData = {
          warehouses: warehouseUtilizations,
          summary,
        };
        break;
      default:
        responseData = {
          summary,
          warehouses: warehouseUtilizations,
          top_utilized_locations: locationUtilizations
            .filter((l) => l.status === 'full' || l.status === 'high')
            .slice(0, 10),
          empty_locations: locationUtilizations.filter((l) => l.status === 'empty').slice(0, 10),
        };
    }

    const response: IntelligenceResponse<typeof responseData> = {
      success: true,
      data: responseData,
      metadata: {
        calculation_method: 'current_qty_divided_by_max_capacity',
        data_window: 'current_snapshot',
        data_points: locationData?.length || 0,
        confidence_level: 'high',
        confidence_percent: 95,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'ข้อมูลการใช้พื้นที่ ณ ปัจจุบัน อาจเปลี่ยนแปลงตามการรับ-จ่ายสินค้า',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Utilization API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

/**
 * AI API: Warehouse Locations Query
 * GET /api/ai/warehouse/locations
 * 
 * ดึงข้อมูลโลเคชั่นคลังสินค้าสำหรับ AI Assistant
 * READ-ONLY, SAFE for AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AIWarehouseLocationParams {
  warehouse_id?: string;
  zone?: string;
  location_type?: 'rack' | 'floor' | 'bulk' | 'other';
  search?: string;
  available_only?: boolean;
  limit?: number;
}

export interface AIWarehouseLocation {
  location_id: string;
  location_code: string;
  location_name: string;
  warehouse_id: string;
  warehouse_name: string;
  location_type: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  max_capacity_qty: number;
  current_qty: number;
  available_qty: number;
  utilization_percent: number;
  max_capacity_weight_kg: number;
  current_weight_kg: number;
  temperature_controlled: boolean;
  humidity_controlled: boolean;
  active_status: string;
  sku_count: number;
  pallet_count: number;
}

export interface AIWarehouseLocationResponse {
  success: boolean;
  data: AIWarehouseLocation[];
  summary: {
    total_locations: number;
    active_locations: number;
    total_capacity: number;
    total_used: number;
    avg_utilization_percent: number;
    by_zone: Record<string, { count: number; utilization: number }>;
    by_type: Record<string, number>;
  };
  query_params: AIWarehouseLocationParams;
  timestamp: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<AIWarehouseLocationResponse>> {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: AIWarehouseLocationParams = {
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      zone: searchParams.get('zone') || undefined,
      location_type: searchParams.get('location_type') as any || undefined,
      search: searchParams.get('search') || undefined,
      available_only: searchParams.get('available_only') === 'true',
      limit: parseInt(searchParams.get('limit') || '100', 10),
    };

    // Build query for locations
    let query = supabase
      .from('master_location')
      .select(`
        location_id,
        location_code,
        location_name,
        warehouse_id,
        location_type,
        zone,
        aisle,
        rack,
        shelf,
        bin,
        max_capacity_qty,
        current_qty,
        max_capacity_weight_kg,
        current_weight_kg,
        temperature_controlled,
        humidity_controlled,
        active_status,
        master_warehouse!warehouse_id (
          warehouse_name
        )
      `)
      .eq('active_status', 'active')
      .order('location_code', { ascending: true });

    // Apply filters
    if (params.warehouse_id) {
      query = query.eq('warehouse_id', params.warehouse_id);
    }

    if (params.zone) {
      query = query.eq('zone', params.zone);
    }

    if (params.location_type) {
      query = query.eq('location_type', params.location_type);
    }

    if (params.search) {
      const hasSpecialChars = /[|,()\\]/.test(params.search);
      if (!hasSpecialChars) {
        query = query.or(`location_code.ilike.%${params.search}%,location_name.ilike.%${params.search}%`);
      }
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      query = query.limit(Math.min(params.limit, 500)); // Max 500 locations
    }

    const { data: locations, error } = await query;

    if (error) {
      console.error('[AI Warehouse Locations] Query error:', error);
      return NextResponse.json({
        success: false,
        data: [],
        summary: {
          total_locations: 0,
          active_locations: 0,
          total_capacity: 0,
          total_used: 0,
          avg_utilization_percent: 0,
          by_zone: {},
          by_type: {},
        },
        query_params: params,
        timestamp: new Date().toISOString(),
        error: error.message,
      }, { status: 500 });
    }

    // Get inventory counts per location
    const locationIds = (locations || []).map(l => l.location_id);
    
    let inventoryCounts: Record<string, { sku_count: number; pallet_count: number }> = {};
    
    if (locationIds.length > 0) {
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('location_id, sku_id, pallet_id')
        .in('location_id', locationIds)
        .gt('total_piece_qty', 0);

      // Count unique SKUs and pallets per location
      (balances || []).forEach(b => {
        if (!inventoryCounts[b.location_id]) {
          inventoryCounts[b.location_id] = { sku_count: 0, pallet_count: 0 };
        }
        inventoryCounts[b.location_id].sku_count++;
        if (b.pallet_id) {
          inventoryCounts[b.location_id].pallet_count++;
        }
      });
    }

    // Transform data
    const transformedData: AIWarehouseLocation[] = (locations || [])
      .map(loc => {
        const warehouse = loc.master_warehouse as any;
        const maxCapacity = Number(loc.max_capacity_qty) || 0;
        const currentQty = Number(loc.current_qty) || 0;
        const availableQty = Math.max(0, maxCapacity - currentQty);
        const utilization = maxCapacity > 0 ? Math.round((currentQty / maxCapacity) * 100) : 0;
        const counts = inventoryCounts[loc.location_id] || { sku_count: 0, pallet_count: 0 };

        return {
          location_id: loc.location_id,
          location_code: loc.location_code,
          location_name: loc.location_name || loc.location_code,
          warehouse_id: loc.warehouse_id,
          warehouse_name: warehouse?.warehouse_name || loc.warehouse_id,
          location_type: loc.location_type || 'other',
          zone: loc.zone,
          aisle: loc.aisle,
          rack: loc.rack,
          shelf: loc.shelf,
          bin: loc.bin,
          max_capacity_qty: maxCapacity,
          current_qty: currentQty,
          available_qty: availableQty,
          utilization_percent: utilization,
          max_capacity_weight_kg: Number(loc.max_capacity_weight_kg) || 0,
          current_weight_kg: Number(loc.current_weight_kg) || 0,
          temperature_controlled: loc.temperature_controlled || false,
          humidity_controlled: loc.humidity_controlled || false,
          active_status: loc.active_status,
          sku_count: counts.sku_count,
          pallet_count: counts.pallet_count,
        };
      })
      .filter(loc => {
        // Filter available only
        if (params.available_only) {
          return loc.available_qty > 0;
        }
        return true;
      });

    // Calculate summary
    const byZone: Record<string, { count: number; utilization: number; totalUtil: number }> = {};
    const byType: Record<string, number> = {};
    let totalCapacity = 0;
    let totalUsed = 0;
    let totalUtilization = 0;

    transformedData.forEach(loc => {
      // By zone
      const zone = loc.zone || 'ไม่ระบุ';
      if (!byZone[zone]) {
        byZone[zone] = { count: 0, utilization: 0, totalUtil: 0 };
      }
      byZone[zone].count++;
      byZone[zone].totalUtil += loc.utilization_percent;

      // By type
      byType[loc.location_type] = (byType[loc.location_type] || 0) + 1;

      // Totals
      totalCapacity += loc.max_capacity_qty;
      totalUsed += loc.current_qty;
      totalUtilization += loc.utilization_percent;
    });

    // Calculate average utilization per zone
    const byZoneFinal: Record<string, { count: number; utilization: number }> = {};
    Object.entries(byZone).forEach(([zone, data]) => {
      byZoneFinal[zone] = {
        count: data.count,
        utilization: data.count > 0 ? Math.round(data.totalUtil / data.count) : 0,
      };
    });

    const summary = {
      total_locations: transformedData.length,
      active_locations: transformedData.filter(l => l.active_status === 'active').length,
      total_capacity: totalCapacity,
      total_used: totalUsed,
      avg_utilization_percent: transformedData.length > 0 
        ? Math.round(totalUtilization / transformedData.length) 
        : 0,
      by_zone: byZoneFinal,
      by_type: byType,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      summary,
      query_params: params,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AI Warehouse Locations] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      summary: {
        total_locations: 0,
        active_locations: 0,
        total_capacity: 0,
        total_used: 0,
        avg_utilization_percent: 0,
        by_zone: {},
        by_type: {},
      },
      query_params: {},
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    }, { status: 500 });
  }
}

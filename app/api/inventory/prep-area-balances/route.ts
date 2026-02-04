import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/inventory/prep-area-balances
 * 
 * Fetch preparation area inventory balances from the dedicated preparation_area_inventory table
 * This provides accurate stock tracking for picking homes (preparation areas)
 * 
 * Query Parameters:
 * - warehouse_id: Filter by warehouse (optional)
 * - preparation_area_code: Filter by specific preparation area (optional)
 * - sku_id: Filter by SKU (optional)
 * - filter_correct_location: Set to 'true' to show only items in correct location (optional)
 * - export: Set to 'true' to fetch all data without pagination (optional)
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const warehouseId = searchParams.get('warehouse_id');
    const prepAreaCode = searchParams.get('preparation_area_code');
    const skuId = searchParams.get('sku_id');
    const filterCorrectLocation = searchParams.get('filter_correct_location') === 'true';
    const isExport = searchParams.get('export') === 'true';

    console.log('🔍 Prep area balances API called with params:', {
      warehouseId,
      prepAreaCode,
      skuId,
      filterCorrectLocation,
      isExport
    });

    // Build query - use the view created by migration 281
    let query = supabase
      .from('vw_preparation_area_inventory')
      .select('*');

    // Apply filters
    if (warehouseId && warehouseId !== 'all') {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (prepAreaCode) {
      query = query.eq('preparation_area_code', prepAreaCode);
    }

    if (skuId) {
      query = query.eq('sku_id', skuId);
    }

    // Filter by correct location (only show items in correct preparation area)
    if (filterCorrectLocation) {
      query = query.eq('is_correct_location', true);
    }

    // Order by updated_at descending
    query = query.order('updated_at', { ascending: false });

    // Apply pagination limit unless exporting
    if (!isExport) {
      query = query.limit(2000);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching prep area balances:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch preparation area inventory', 
          details: error.message,
          code: error.code 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${data?.length || 0} prep area inventory records`);

    // Transform data to match the UI's expected format
    const transformedData = (data || []).map(item => ({
      balance_id: item.inventory_id,
      warehouse_id: item.warehouse_id,
      warehouse_name: item.warehouse_name,
      location_id: item.preparation_area_code,
      location_name: item.preparation_area_name,
      sku_id: item.sku_id,
      sku_name: item.sku_name,
      pallet_id: item.latest_pallet_id,
      pallet_id_external: item.latest_pallet_id_external,
      lot_no: item.latest_lot_no,
      production_date: item.latest_production_date,
      expiry_date: item.latest_expiry_date,
      
      // Use the correct column names from vw_preparation_area_inventory
      total_piece_qty: item.total_piece_qty || 0,
      total_pack_qty: item.total_pack_qty || 0,
      reserved_piece_qty: item.reserved_piece_qty || 0,
      reserved_pack_qty: item.reserved_pack_qty || 0,
      available_piece_qty: item.available_piece_qty || 0,
      available_pack_qty: item.available_pack_qty || 0,
      
      // Additional metadata
      qty_per_pack: item.qty_per_pack,
      weight_per_piece_kg: item.weight_per_piece_kg,
      uom_base: item.uom_base,
      zone: item.zone,
      days_until_expiry: item.days_until_expiry,
      is_expired: item.is_expired,
      last_movement_at: item.last_movement_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
      
      // Location validation fields (from migration 282)
      default_location: item.default_location,
      is_correct_location: item.is_correct_location,
      expected_location: item.expected_location,
      
      // Nested objects for compatibility with existing UI
      master_sku: {
        sku_name: item.sku_name,
        weight_per_piece_kg: item.weight_per_piece_kg,
        qty_per_pack: item.qty_per_pack,
        uom_base: item.uom_base
      },
      master_warehouse: {
        warehouse_name: item.warehouse_name
      },
      master_location: {
        location_name: item.preparation_area_name
      }
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      count: transformedData.length
    });

  } catch (error: any) {
    console.error('❌ Unexpected error in prep-area-balances API:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

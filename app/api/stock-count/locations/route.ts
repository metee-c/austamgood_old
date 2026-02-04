import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/stock-count/locations
 * ดึงรายการโลเคชั่นทั้งหมดพร้อมสถานะสินค้า
 * หรือตรวจสอบว่า code ที่ส่งมาเป็นโลเคชั่นหรือไม่
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH001';
    const code = searchParams.get('code');

    // ถ้ามี code parameter - ตรวจสอบว่าเป็นโลเคชั่นหรือไม่
    if (code) {
      const { data: location, error: locError } = await supabase
        .from('master_location')
        .select('location_id, location_code')
        .eq('location_code', code.toUpperCase())
        .single();

      if (locError && locError.code !== 'PGRST116') {
        throw locError;
      }

      return NextResponse.json({
        success: true,
        is_location: !!location,
        location: location || null
      });
    }

    // ดึงโลเคชั่นทั้งหมด
    const { data: locations, error: locError } = await supabase
      .from('master_location')
      .select('location_id, location_code, zone, aisle, rack, level')
      .eq('warehouse_id', warehouseId)
      .order('location_code');

    if (locError) throw locError;

    // ดึงสินค้าในแต่ละโลเคชั่น
    const { data: inventory, error: invError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        location_code,
        pallet_id,
        sku_code,
        quantity,
        master_sku(sku_name)
      `)
      .gt('quantity', 0);

    if (invError) throw invError;

    // Map inventory by location
    const inventoryByLocation = new Map<string, typeof inventory>();
    for (const inv of inventory || []) {
      const existing = inventoryByLocation.get(inv.location_code) || [];
      existing.push(inv);
      inventoryByLocation.set(inv.location_code, existing);
    }

    // Combine locations with inventory
    const result = (locations || []).map(loc => ({
      ...loc,
      has_inventory: inventoryByLocation.has(loc.location_code),
      inventory_count: inventoryByLocation.get(loc.location_code)?.length || 0,
      inventory: inventoryByLocation.get(loc.location_code) || []
    }));

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
      with_inventory: result.filter(r => r.has_inventory).length
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

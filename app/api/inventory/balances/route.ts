// ============================================================================
// API Route: Inventory Balances
// GET /api/inventory/balances - ดึงข้อมูล inventory balance พร้อม filter
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const warehouseId = searchParams.get('warehouse_id');
    const locationId = searchParams.get('location_id');
    const skuId = searchParams.get('sku_id');
    const palletId = searchParams.get('pallet_id');
    const limit = searchParams.get('limit') || '100';

    // สร้าง query
    let query = supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku (
          sku_id,
          sku_name,
          weight_per_piece_kg
        ),
        master_location (
          location_id,
          location_code,
          location_name,
          location_type,
          zone
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (skuId) {
      query = query.eq('sku_id', skuId);
    }

    if (palletId) {
      // ค้นหาทั้ง pallet_id และ pallet_id_external
      query = query.or(`pallet_id.eq.${palletId},pallet_id_external.eq.${palletId}`);
    }

    // Apply limit
    query = query.limit(parseInt(limit));

    const { data, error } = await query;

    if (error) {
      console.error('Inventory balances fetch error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      error: null
    });
  } catch (error: any) {
    console.error('Inventory balances API error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

// ============================================================================
// API Route: Inventory Balances
// GET /api/inventory/balances - ดึงข้อมูล inventory balance พร้อม filter
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว

    const warehouseId = searchParams.get('warehouse_id');
    const locationId = searchParams.get('location_id');
    const skuId = searchParams.get('sku_id');
    const palletId = searchParams.get('pallet_id');
    
    // Pagination parameters
    // สร้าง query - กรองเฉพาะ balance ที่มีสต็อก > 0
    let query = supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku (
          sku_id,
          sku_name,
          weight_per_piece_kg,
          default_location
        ),
        master_location (
          location_id,
          location_code,
          location_name,
          location_type,
          zone
        )
      `)
      .gt('total_piece_qty', 0)
      .order('sku_id', { ascending: true })
      .order('production_date', { ascending: true });

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
      // ใช้ filter แยกเพื่อรองรับค่าที่มีอักขระพิเศษ เช่น วงเล็บ
      const { data: palletData, error: palletError } = await supabase
        .from('wms_inventory_balances')
        .select(`
          *,
          master_sku (
            sku_id,
            sku_name,
            weight_per_piece_kg,
            default_location
          ),
          master_location (
            location_id,
            location_code,
            location_name,
            location_type,
            zone
          )
        `)
        .gt('total_piece_qty', 0)
        .or(`pallet_id.eq."${palletId}",pallet_id_external.eq."${palletId}"`)
        .order('sku_id', { ascending: true })
        .order('production_date', { ascending: true });

      if (palletError) {
        console.error('Inventory balances fetch error:', palletError);
        return NextResponse.json(
          { error: palletError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: palletData || [],
        error: null
      });
    }

    // Apply pagination
    query = query;

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

export const GET = withShadowLog(_GET);

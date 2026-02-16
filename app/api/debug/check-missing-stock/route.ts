// ============================================================================
// Debug API: ตรวจสอบสต็อกที่หายไปจาก batch IMP-20260105-100
// GET /api/debug/check-missing-stock
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const batchId = 'IMP-20260105-100';

    // 1. ดึง SKUs ที่นำเข้าจาก CSV
    const { data: importedSkus } = await supabase
      .from('wms_stock_import_staging')
      .select('sku_id, location_id, piece_qty')
      .eq('import_batch_id', batchId)
      .eq('processing_status', 'processed')
      .limit(100);

    const uniqueSkus = [...new Set(importedSkus?.map(s => s.sku_id))];
    const uniqueLocations = [...new Set(importedSkus?.map(s => s.location_id))];

    // 2. ตรวจสอบว่า SKUs เหล่านี้มีอยู่ที่ไหนบ้างในระบบ
    const { data: currentBalances } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .in('sku_id', uniqueSkus.slice(0, 50))
      .gt('total_piece_qty', 0)
      .order('updated_at', { ascending: false });

    // 3. ตรวจสอบ master_location ว่า location_id ที่นำเข้ามีอยู่จริงหรือไม่
    const { data: masterLocations } = await supabase
      .from('master_location')
      .select('location_id, location_code, location_name, zone')
      .in('location_code', uniqueLocations.slice(0, 50));

    // 4. ตรวจสอบ ledger entries ล่าสุดของ SKUs เหล่านี้
    const { data: recentLedger } = await supabase
      .from('wms_inventory_ledger')
      .select(`
        *,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .in('sku_id', uniqueSkus.slice(0, 20))
      .order('created_at', { ascending: false })
      .limit(50);

    // 5. ตรวจสอบ balances ที่มี total_piece_qty = 0 (ถูกย้ายออกไปแล้ว)
    const { data: zeroBalances } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .in('sku_id', uniqueSkus.slice(0, 20))
      .eq('total_piece_qty', 0)
      .order('updated_at', { ascending: false })
      .limit(20);

    // 6. หา SKUs ที่นำเข้า แต่ไม่พบใน balances เลย
    const currentSkusInBalances = new Set(currentBalances?.map(b => b.sku_id) || []);
    const missingSku = uniqueSkus.filter(sku => !currentSkusInBalances.has(sku));

    // 7. ตรวจสอบว่า SKUs ที่หายไปมีใน ledger หรือไม่
    const { data: missingSkuLedger } = await supabase
      .from('wms_inventory_ledger')
      .select('sku_id, location_id, piece_qty, direction, transaction_type, created_at')
      .in('sku_id', missingSku.slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      summary: {
        total_imported_skus: uniqueSkus.length,
        total_imported_locations: uniqueLocations.length,
        current_balances_with_stock: currentBalances?.length || 0,
        zero_balances: zeroBalances?.length || 0,
        missing_skus_count: missingSku.length,
      },
      imported_sample: importedSkus?.slice(0, 5),
      unique_locations: uniqueLocations.slice(0, 20),
      master_locations: masterLocations,
      current_balances_sample: currentBalances?.slice(0, 5),
      zero_balances_sample: zeroBalances?.slice(0, 5),
      recent_ledger_sample: recentLedger?.slice(0, 5),
      missing_skus: {
        count: missingSku.length,
        list: missingSku.slice(0, 10),
        ledger_entries: missingSkuLedger,
      },
    });
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

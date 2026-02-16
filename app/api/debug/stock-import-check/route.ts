// ============================================================================
// Debug API: ตรวจสอบสต็อกที่นำเข้าจาก batch IMP-20260105-100
// GET /api/debug/stock-import-check
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const batchId = 'IMP-20260105-100';

    // 1. ตรวจสอบ batch info
    const { data: batch } = await supabase
      .from('wms_stock_import_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    // 2. ตรวจสอบ staging records (ดูว่า processed ไปหรือยัง)
    const { data: staging, count: stagingCount } = await supabase
      .from('wms_stock_import_staging')
      .select('*', { count: 'exact' })
      .eq('import_batch_id', batchId)
      .order('processing_status')
      .limit(10);

    // นับตาม status
    const { data: statusCounts } = await supabase
      .from('wms_stock_import_staging')
      .select('processing_status')
      .eq('import_batch_id', batchId);

    const statusSummary = statusCounts?.reduce((acc: any, row: any) => {
      acc[row.processing_status] = (acc[row.processing_status] || 0) + 1;
      return acc;
    }, {});

    // 3. ตรวจสอบ inventory ledger ที่สร้างจาก batch นี้
    const { data: ledgerEntries, count: ledgerCount } = await supabase
      .from('wms_inventory_ledger')
      .select('*, master_sku(sku_name), master_location(location_name)', { count: 'exact' })
      .eq('reference_no', batchId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. ตรวจสอบ inventory balances ที่มี SKU จาก batch นี้
    // ดึง SKU IDs จาก staging
    const skuIds = [...new Set(staging?.map(s => s.sku_id).filter(Boolean))] as string[];

    let balanceData: any[] = [];
    let balanceCount = 0;

    if (skuIds.length > 0) {
      const { data: balances, count } = await supabase
        .from('wms_inventory_balances')
        .select('*, master_sku(sku_name), master_location(location_name, zone)', { count: 'exact' })
        .in('sku_id', skuIds.slice(0, 50)) // ดูแค่ 50 SKU แรก
        .order('updated_at', { ascending: false })
        .limit(20);

      balanceData = balances || [];
      balanceCount = count || 0;
    }

    // 5. ตรวจสอบ SKUs ตัวอย่างจาก CSV (PRE-BAG|CAV|CM|R, PRE-TSH|PX|NB-3XL|B, MKT-VIN|ALL)
    const sampleSkus = ['PRE-BAG|CAV|CM|R', 'PRE-TSH|PX|NB-3XL|B', 'MKT-VIN|ALL'];
    const { data: sampleSkuBalances } = await supabase
      .from('wms_inventory_balances')
      .select('*, master_sku(sku_name), master_location(location_name, zone)')
      .in('sku_id', sampleSkus);

    // 6. ตรวจสอบ locations ตัวอย่าง (MCF-AB02, MCF-AB04, MCF-AC01)
    const sampleLocations = ['MCF-AB02', 'MCF-AB04', 'MCF-AC01'];
    const { data: locationBalances } = await supabase
      .from('wms_inventory_balances')
      .select('*, master_sku(sku_name), master_location(location_name, zone)')
      .in('location_id', sampleLocations);

    return NextResponse.json({
      batch_info: batch,
      staging: {
        total_count: stagingCount,
        status_summary: statusSummary,
        sample_records: staging?.slice(0, 5),
      },
      ledger: {
        total_count: ledgerCount,
        sample_entries: ledgerEntries?.slice(0, 5),
      },
      balances: {
        total_count: balanceCount,
        sample_balances: balanceData.slice(0, 5),
      },
      sample_sku_check: {
        skus_checked: sampleSkus,
        results: sampleSkuBalances,
      },
      sample_location_check: {
        locations_checked: sampleLocations,
        results: locationBalances,
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

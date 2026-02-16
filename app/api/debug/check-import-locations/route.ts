// ============================================================================
// Debug API: ตรวจสอบว่าสินค้าถูกนำเข้าที่ location ไหน
// GET /api/debug/check-import-locations
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const batchId = 'IMP-20260105-100';

    // 1. ตรวจสอบ ledger entries ที่สร้างจากการนำเข้า (ดู location ที่นำเข้าจริง)
    const { data: importLedger } = await supabase
      .from('wms_inventory_ledger')
      .select(`
        ledger_id,
        sku_id,
        location_id,
        pallet_id_external,
        piece_qty,
        reference_no,
        transaction_type,
        direction,
        created_at,
        master_sku(sku_name),
        master_location(location_id, location_name, zone)
      `)
      .eq('reference_no', batchId)
      .eq('transaction_type', 'STOCK_IMPORT')
      .order('created_at')
      .limit(100);

    // 2. ตรวจสอบ staging records เพื่อดูว่า CSV ระบุ location อะไร
    const { data: staging } = await supabase
      .from('wms_stock_import_staging')
      .select('staging_id, sku_id, location_id, piece_qty, pallet_id_external')
      .eq('import_batch_id', batchId)
      .eq('processing_status', 'processed')
      .limit(100);

    // 3. เปรียบเทียบว่า location ใน staging vs ledger ตรงกันหรือไม่
    const comparison = staging?.map(s => {
      const ledgerEntry = importLedger?.find(l =>
        l.sku_id === s.sku_id &&
        l.pallet_id_external === s.pallet_id_external
      );

      const masterLocation = Array.isArray(ledgerEntry?.master_location)
        ? ledgerEntry?.master_location[0]
        : ledgerEntry?.master_location;

      return {
        sku_id: s.sku_id,
        staging_location: s.location_id,
        ledger_location: masterLocation?.location_id,
        ledger_location_name: masterLocation?.location_name,
        matched: s.location_id === masterLocation?.location_id,
        piece_qty: s.piece_qty,
      };
    });

    // 4. ดูว่ามี transfer ออกหรือไม่
    const locationIds = [...new Set(importLedger?.map(l => l.location_id))];
    const skuIds = [...new Set(importLedger?.map(l => l.sku_id).slice(0, 20))];

    const { data: transfersOut } = await supabase
      .from('wms_inventory_ledger')
      .select(`
        ledger_id,
        movement_at,
        sku_id,
        location_id,
        piece_qty,
        reference_no,
        transaction_type,
        direction,
        master_location(location_id, location_name)
      `)
      .in('sku_id', skuIds)
      .in('location_id', locationIds.slice(0, 20))
      .eq('direction', 'out')
      .order('created_at', { ascending: false })
      .limit(50);

    // 5. สรุป
    const summary = {
      total_imported: importLedger?.length || 0,
      locations_imported_to: [...new Set(importLedger?.map(l => {
        const masterLocation = Array.isArray(l.master_location)
          ? l.master_location[0]
          : l.master_location;
        return masterLocation?.location_id;
      }))],
      staging_locations: [...new Set(staging?.map(s => s.location_id))],
      matched_count: comparison?.filter(c => c.matched).length,
      mismatched_count: comparison?.filter(c => !c.matched).length,
      total_transfers_out: transfersOut?.length || 0,
    };

    return NextResponse.json({
      summary,
      import_ledger_sample: importLedger?.slice(0, 10),
      staging_sample: staging?.slice(0, 10),
      comparison_sample: comparison?.slice(0, 10),
      transfers_out_sample: transfersOut?.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

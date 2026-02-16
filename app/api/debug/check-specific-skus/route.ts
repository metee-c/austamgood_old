// ============================================================================
// Debug API: ตรวจสอบ SKU เฉพาะที่ user ถาม
// GET /api/debug/check-specific-skus
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // SKUs ที่ต้องการตรวจสอบ
    const targetSkus = [
      'PRE-BAG|CAV|CM|R',
      'PRE-TSH|PX|NB-3XL|B',
      'PRE-TSH|PX|NB-2XL|B',
      'PRE-TSH|PX|NB-XL|B',
      'PRE-TSH|PX|NB-L|B',
      'PRE-TSH|PX|NB-M|B',
      'PRE-TSH|PX|NB-S|B',
      'PRE-TSH|PX|NB-3XL',
      'PRE-TSH|PX|NB-2XL',
      'PRE-TSH|PX|NB-XL',
      'PRE-TSH|PX|NB-L',
      'PRE-TSH|PX|NB-S',
      'MKT-VIN|ALL',
    ];

    // Pallet IDs ที่ต้องการตรวจสอบ (ตัวอย่าง)
    const targetPallets = [
      'ATG2500017272',
      'ATG2500017271',
      'ATG2500017270',
      'ATG2500015289',
      'ATG2500015288',
      'ATG2500017396',
      'ATG2500017395',
    ];

    // 1. ตรวจสอบ balances ของ SKUs เหล่านี้ (ทั้งที่มีสต็อกและไม่มีสต็อก)
    const { data: allBalances } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .in('sku_id', targetSkus)
      .order('total_piece_qty', { ascending: false });

    // 2. แยกตาม location
    const balancesByLocation: Record<string, any[]> = {};
    allBalances?.forEach(b => {
      const loc = b.master_location?.location_code || b.location_id;
      if (!balancesByLocation[loc]) {
        balancesByLocation[loc] = [];
      }
      balancesByLocation[loc].push({
        sku_id: b.sku_id,
        sku_name: b.master_sku?.sku_name,
        pallet_id: b.pallet_id || b.pallet_id_external,
        total_piece_qty: b.total_piece_qty,
        zone: b.master_location?.zone,
      });
    });

    // 3. ตรวจสอบ ledger ล่าสุดของ SKUs เหล่านี้
    const { data: recentLedger } = await supabase
      .from('wms_inventory_ledger')
      .select(`
        ledger_id,
        movement_at,
        transaction_type,
        direction,
        location_id,
        sku_id,
        pallet_id_external,
        piece_qty,
        reference_no,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .in('sku_id', targetSkus)
      .order('created_at', { ascending: false })
      .limit(50);

    // 4. ตรวจสอบ pallets เฉพาะ
    const { data: palletBalances } = await supabase
      .from('wms_inventory_balances')
      .select(`
        *,
        master_sku(sku_name),
        master_location(location_code, location_name, zone)
      `)
      .or(`pallet_id.in.(${targetPallets.join(',')}),pallet_id_external.in.(${targetPallets.join(',')})`)
      .order('total_piece_qty', { ascending: false });

    // 5. สรุปข้อมูล
    const summary = {
      total_skus_checked: targetSkus.length,
      total_balances_found: allBalances?.length || 0,
      locations_with_stock: Object.keys(balancesByLocation).filter(
        loc => balancesByLocation[loc].some((b: any) => b.total_piece_qty > 0)
      ).length,
      locations_without_stock: Object.keys(balancesByLocation).filter(
        loc => balancesByLocation[loc].every((b: any) => b.total_piece_qty === 0)
      ).length,
    };

    // 6. แยก SKUs ที่มีสต็อก vs ไม่มีสต็อก
    const skusWithStock = targetSkus.filter(sku =>
      allBalances?.some(b => b.sku_id === sku && b.total_piece_qty > 0)
    );
    const skusWithoutStock = targetSkus.filter(sku =>
      !allBalances?.some(b => b.sku_id === sku && b.total_piece_qty > 0)
    );

    return NextResponse.json({
      summary,
      skus_with_stock: skusWithStock,
      skus_without_stock: skusWithoutStock,
      balances_by_location: balancesByLocation,
      all_balances: allBalances?.slice(0, 20),
      recent_ledger: recentLedger?.slice(0, 10),
      pallet_check: palletBalances,
    });
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

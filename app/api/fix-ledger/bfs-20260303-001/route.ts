/**
 * One-time fix: Correct incorrect ledger entries for BFS-20260303-001
 *
 * Problem: BFS scan API picked stock from "Return" location (via pallet ATG20260303040)
 *          instead of each SKU's home pick location (prep area)
 * Fix: For each wrong OUT at Return:
 *   1) IN back to Return (restore balance)
 *   2) OUT from correct home pick location (deduct from prep area)
 *
 * Usage: POST /api/fix-ledger/bfs-20260303-001
 * Body: { "dry_run": true } to preview, { "dry_run": false } to execute
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { executeStockMovements, type StockMovement } from '@/lib/database/inventory-transaction';

export const dynamic = 'force-dynamic';

const TARGET_BFS = 'BFS-20260303-001';
const WRONG_LOCATION = 'Return';

export async function POST(request: Request) {
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default to dry run

    // 1. Find ALL ledger entries for BFS-20260303-001 at Return location (wrong OUT entries)
    const { data: wrongEntries, error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .select('*')
      .eq('reference_no', TARGET_BFS)
      .eq('location_id', WRONG_LOCATION)
      .eq('direction', 'out')
      .order('created_at', { ascending: true });

    if (ledgerError) {
      return NextResponse.json({ error: 'Failed to query ledger', details: ledgerError.message }, { status: 500 });
    }

    if (!wrongEntries || wrongEntries.length === 0) {
      // Also try searching more broadly
      const { data: allBfsEntries } = await supabase
        .from('wms_inventory_ledger')
        .select('ledger_id, sku_id, direction, location_id, piece_qty, pack_qty, pallet_id, created_at')
        .eq('reference_no', TARGET_BFS)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        message: 'No wrong OUT entries found at Return location for BFS-20260303-001',
        all_bfs_entries: allBfsEntries || []
      });
    }

    console.log(`Found ${wrongEntries.length} wrong OUT entries at Return for ${TARGET_BFS}`);

    // 2. Get unique SKU IDs from wrong entries
    const skuIds = [...new Set(wrongEntries.map(e => e.sku_id))];
    const warehouseId = wrongEntries[0].warehouse_id;

    // 3. Find home pick location for each SKU
    const skuHomePickMap = new Map<string, { location_id: string; location_code: string }>();

    for (const skuId of skuIds) {
      // Try sku_preparation_area_mapping first
      const { data: prepMapping } = await supabase
        .from('sku_preparation_area_mapping')
        .select(`
          preparation_area (
            area_id, area_code, location_id
          )
        `)
        .eq('sku_id', skuId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle();

      if (prepMapping?.preparation_area) {
        const pa = prepMapping.preparation_area as any;
        if (pa.location_id) {
          const { data: loc } = await supabase
            .from('master_location')
            .select('location_code')
            .eq('location_id', pa.location_id)
            .maybeSingle();
          skuHomePickMap.set(skuId, {
            location_id: pa.location_id,
            location_code: loc?.location_code || pa.area_code
          });
          continue;
        }
      }

      // Fallback: default_location on master_sku
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('default_location')
        .eq('sku_id', skuId)
        .maybeSingle();

      if (skuData?.default_location) {
        const { data: loc } = await supabase
          .from('master_location')
          .select('location_code')
          .eq('location_id', skuData.default_location)
          .maybeSingle();
        skuHomePickMap.set(skuId, {
          location_id: skuData.default_location,
          location_code: loc?.location_code || skuData.default_location
        });
      }
    }

    // 4. Build correction movements
    const corrections: StockMovement[] = [];
    const skippedEntries: any[] = [];
    const correctedEntries: any[] = [];

    for (const entry of wrongEntries) {
      const homePick = skuHomePickMap.get(entry.sku_id);

      if (!homePick) {
        skippedEntries.push({
          ledger_id: entry.ledger_id,
          sku_id: entry.sku_id,
          piece_qty: entry.piece_qty,
          reason: 'No home pick location found'
        });
        continue;
      }

      // If home pick is the same as Return, no correction needed
      if (homePick.location_id === WRONG_LOCATION) {
        skippedEntries.push({
          ledger_id: entry.ledger_id,
          sku_id: entry.sku_id,
          piece_qty: entry.piece_qty,
          reason: 'Home pick IS Return location (no correction needed)'
        });
        continue;
      }

      correctedEntries.push({
        ledger_id: entry.ledger_id,
        sku_id: entry.sku_id,
        piece_qty: entry.piece_qty,
        pack_qty: entry.pack_qty,
        wrong_location: WRONG_LOCATION,
        correct_location: homePick.location_code
      });

      // a) Reverse: IN back to Return (restore balance at Return)
      corrections.push({
        direction: 'in',
        warehouse_id: entry.warehouse_id,
        location_id: WRONG_LOCATION,
        sku_id: entry.sku_id,
        pallet_id: entry.pallet_id || null,
        production_date: entry.production_date,
        expiry_date: entry.expiry_date,
        lot_no: null,
        piece_qty: entry.piece_qty,
        pack_qty: entry.pack_qty || 0,
        transaction_type: 'adjustment',
        reference_no: TARGET_BFS,
        reference_doc_type: 'ledger_correction',
        remarks: `Correction: reverse wrong OUT from Return (ledger_id: ${entry.ledger_id}, SKU: ${entry.sku_id})`
      });

      // b) Correct: OUT from home pick location (deduct from correct location)
      corrections.push({
        direction: 'out',
        warehouse_id: entry.warehouse_id,
        location_id: homePick.location_id,
        sku_id: entry.sku_id,
        pallet_id: null, // home pick uses null pallet (prep area pattern)
        production_date: entry.production_date,
        expiry_date: entry.expiry_date,
        lot_no: null,
        piece_qty: entry.piece_qty,
        pack_qty: entry.pack_qty || 0,
        transaction_type: 'adjustment',
        reference_no: TARGET_BFS,
        reference_doc_type: 'ledger_correction',
        remarks: `Correction: correct OUT from ${homePick.location_code} (was Return, ledger_id: ${entry.ledger_id})`
      });
    }

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        message: `Found ${wrongEntries.length} wrong OUT entries at Return. Will correct ${correctedEntries.length}, skip ${skippedEntries.length}. Total ${corrections.length} correction movements.`,
        corrected_entries: correctedEntries,
        skipped_entries: skippedEntries,
        sku_home_picks: Object.fromEntries(skuHomePickMap),
        planned_corrections: corrections.map(c => ({
          direction: c.direction,
          location_id: c.location_id,
          sku_id: c.sku_id,
          piece_qty: c.piece_qty,
          pack_qty: c.pack_qty,
          remarks: c.remarks
        }))
      });
    }

    // 5. Execute corrections
    if (corrections.length === 0) {
      return NextResponse.json({
        message: 'No corrections to execute',
        skipped_entries: skippedEntries
      });
    }

    const result = await executeStockMovements(corrections);

    if (!result.success) {
      return NextResponse.json({
        error: 'Failed to execute corrections',
        details: result.error,
        planned_corrections: corrections
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Corrected ${correctedEntries.length} wrong OUT entries. Created ${corrections.length} correction ledger entries.`,
      correction_results: result.entries,
      corrected_entries: correctedEntries,
      skipped_entries: skippedEntries
    });

  } catch (err: any) {
    console.error('Fix ledger error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'Fix incorrect ledger entries for BFS-20260303-001 at Return location',
    usage: 'POST with { "dry_run": true } to preview, { "dry_run": false } to execute',
    target_bfs: TARGET_BFS,
    wrong_location: WRONG_LOCATION
  });
}

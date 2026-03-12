/**
 * One-time fix: Correct expiry_date for specific pallets from Excel "แก้ไข Lot"
 *
 * Updates wms_inventory_balances.expiry_date for each pallet_id
 * Also updates wms_inventory_ledger.expiry_date for matching entries
 *
 * Usage: POST /api/fix-ledger/fix-expiry
 * Body: { "dry_run": true } to preview, { "dry_run": false } to execute
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Pallet ID -> correct expiry_date (from user-provided data, DD/MM/YYYY -> YYYY-MM-DD)
const PALLET_EXPIRY_MAP: Record<string, string> = {
  // BLK-02: 7/2/2027
  'ATG2500015963': '2027-02-07',
  'ATG2500015991': '2027-02-07',
  'ATG2500015987': '2027-02-07',
  'ATG2500015974': '2027-02-07',
  'ATG2500015997': '2027-02-07',
  'ATG2500015992': '2027-02-07',
  'ATG2500016003': '2027-02-07',
  'ATG2500015990': '2027-02-07',
  'ATG2500015999': '2027-02-07',
  'ATG2500015998': '2027-02-07',
  'ATG2500015988': '2027-02-07',
  'ATG2500015993': '2027-02-07',
  'ATG2500016006': '2027-02-07',
  'ATG2500016001': '2027-02-07',
  'ATG2500016005': '2027-02-07',
  'ATG2500015986': '2027-02-07',
  'ATG2500015989': '2027-02-07',
  'ATG2500015961': '2027-02-07',
  'ATG2500016002': '2027-02-07',
  'ATG2500016007': '2027-02-07',
  'ATG2500016008': '2027-02-07',
  'ATG2500015995': '2027-02-07',
  'ATG2500016009': '2027-02-07',
  'ATG2500015994': '2027-02-07',
  'ATG2500016000': '2027-02-07',
  'ATG2500015996': '2027-02-07',
  'ATG2500016004': '2027-02-07',
  'ATG2500016010': '2027-02-07',
  // BLK-03: mix of 1/12/2026 and 7/2/2027
  'ATG2500015973': '2026-12-01',
  'ATG2500015969': '2027-02-07',
  'ATG2500016011': '2027-02-07',
  'ATG2500016034': '2027-02-07',
  'ATG2500015970': '2026-12-01',
  'ATG2500016019': '2027-02-07',
  'ATG2500016023': '2027-02-07',
  'ATG2500015965': '2026-12-01',
  'ATG2500016030': '2027-02-07',
  'ATG2500016017': '2027-02-07',
  'ATG2500015964': '2027-02-07',
  'ATG2500016032': '2027-02-07',
  'ATG2500016018': '2027-02-07',
  'ATG2500016029': '2027-02-07',
  'ATG2500016026': '2027-02-07',
  'ATG2500016021': '2027-02-07',
  'ATG2500016031': '2027-02-07',
  'ATG2500016024': '2027-02-07',
  'ATG2500016027': '2027-02-07',
  'ATG2500016025': '2027-02-07',
  'ATG2500015968': '2026-12-01',
  'ATG2500016028': '2027-02-07',
  'ATG2500016020': '2027-02-07',
  'ATG2500016022': '2027-02-07',
  'ATG2500016033': '2027-02-07',
  'ATG2500015972': '2026-12-01',
  'ATG2500015971': '2027-02-07',
  'ATG2500016035': '2027-02-07',
  // BLK-04: all 1/12/2026
  'ATG2500013273': '2026-12-01',
  'ATG2500013283': '2026-12-01',
  'ATG2500013272': '2026-12-01',
  'ATG2500013270': '2026-12-01',
  'ATG2500013284': '2026-12-01',
  'ATG2500013271': '2026-12-01',
  'ATG2500013269': '2026-12-01',
  'ATG2500013458': '2026-12-01',
  'ATG2500013282': '2026-12-01',
  // BLK-18: all 3/12/2026
  'ATG2500016134': '2026-12-03',
  'ATG2500015980': '2026-12-03',
  'ATG2500015983': '2026-12-03',
  'ATG2500016141': '2026-12-03',
  'ATG2500016133': '2026-12-03',
  'ATG2500016140': '2026-12-03',
  'ATG2500016142': '2026-12-03',
  'ATG2500015984': '2026-12-03',
  'ATG2500016128': '2026-12-03',
  'ATG2500016137': '2026-12-03',
  'ATG2500015982': '2026-12-03',
  'ATG2500016131': '2026-12-03',
  'ATG2500015978': '2026-12-03',
  'ATG2500015985': '2026-12-03',
  'ATG2500016136': '2026-12-03',
  'ATG2500016129': '2026-12-03',
  'ATG2500016130': '2026-12-03',
  // BLK-22: all 1/12/2026
  'ATG2500013409': '2026-12-01',
  'ATG2500013413': '2026-12-01',
  'ATG2500013418': '2026-12-01',
  'ATG2500013417': '2026-12-01',
  'ATG2500013411': '2026-12-01',
  'ATG2500013415': '2026-12-01',
  'ATG2500013416': '2026-12-01',
  'ATG2500013408': '2026-12-01',
  // BLK-23: all 27/11/2026
  'ATG2500013370': '2026-11-27',
  'ATG2500013371': '2026-11-27',
  'ATG2500013376': '2026-11-27',
  'ATG2500013378': '2026-11-27',
  'ATG2500013374': '2026-11-27',
  'ATG2500013381': '2026-11-27',
  'ATG2500013373': '2026-11-27',
  'ATG2500013372': '2026-11-27',
  'ATG2500013380': '2026-11-27',
  'ATG2500013382': '2026-11-27',
  'ATG2500013375': '2026-11-27',
};

export async function POST(request: Request) {
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;

    const palletIds = Object.keys(PALLET_EXPIRY_MAP);
    console.log(`Processing ${palletIds.length} pallets...`);

    // 1. Check current expiry_date in balances
    const { data: currentBalances, error: balError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, pallet_id, sku_id, expiry_date, location_id')
      .in('pallet_id', palletIds);

    if (balError) {
      return NextResponse.json({ error: 'Failed to query balances', details: balError.message }, { status: 500 });
    }

    // Build update plan - handle multiple balances per pallet_id
    const updates: Array<{
      balance_id: number;
      pallet_id: string;
      sku_id: string;
      location_id: string;
      current_expiry: string | null;
      correct_expiry: string;
      needs_update: boolean;
    }> = [];

    const notFound: string[] = [];
    const balancePalletSet = new Set((currentBalances || []).map(b => b.pallet_id));

    for (const palletId of palletIds) {
      // Find ALL balances for this pallet (could be at multiple locations)
      const balances = currentBalances?.filter(b => b.pallet_id === palletId) || [];
      if (balances.length === 0) {
        notFound.push(palletId);
        continue;
      }

      const correctExpiry = PALLET_EXPIRY_MAP[palletId];

      for (const balance of balances) {
        const currentExpiry = balance.expiry_date;
        const needsUpdate = currentExpiry !== correctExpiry;

        updates.push({
          balance_id: balance.balance_id,
          pallet_id: palletId,
          sku_id: balance.sku_id,
          location_id: balance.location_id,
          current_expiry: currentExpiry,
          correct_expiry: correctExpiry,
          needs_update: needsUpdate
        });
      }
    }

    const toUpdate = updates.filter(u => u.needs_update);
    const alreadyCorrect = updates.filter(u => !u.needs_update);

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        total_pallets: palletIds.length,
        total_balance_records: updates.length,
        not_found: notFound.length,
        needs_update: toUpdate.length,
        already_correct: alreadyCorrect.length,
        updates_planned: toUpdate.map(u => ({
          balance_id: u.balance_id,
          pallet_id: u.pallet_id,
          sku_id: u.sku_id,
          location_id: u.location_id,
          current_expiry: u.current_expiry,
          correct_expiry: u.correct_expiry
        })),
        not_found_pallets: notFound
      });
    }

    // 2. Execute updates
    let balanceUpdated = 0;
    let ledgerUpdated = 0;
    const errors: string[] = [];

    for (const update of toUpdate) {
      // Update balance
      const { error: updErr } = await supabase
        .from('wms_inventory_balances')
        .update({ expiry_date: update.correct_expiry })
        .eq('balance_id', update.balance_id);

      if (updErr) {
        errors.push(`Balance ${update.balance_id} (${update.pallet_id}): ${updErr.message}`);
      } else {
        balanceUpdated++;
      }

      // Update ALL ledger entries for this pallet that don't have the correct expiry
      const { data: ledgerResult, error: ledErr } = await supabase
        .from('wms_inventory_ledger')
        .update({ expiry_date: update.correct_expiry })
        .eq('pallet_id', update.pallet_id)
        .neq('expiry_date', update.correct_expiry)
        .select('ledger_id');

      if (ledErr) {
        errors.push(`Ledger for ${update.pallet_id}: ${ledErr.message}`);
      } else {
        ledgerUpdated += ledgerResult?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${balanceUpdated} balances, ${ledgerUpdated} ledger entries.`,
      balance_updated: balanceUpdated,
      ledger_updated: ledgerUpdated,
      not_found: notFound.length,
      already_correct: alreadyCorrect.length,
      errors: errors.length > 0 ? errors : undefined,
      not_found_pallets: notFound.length > 0 ? notFound : undefined
    });

  } catch (err: any) {
    console.error('Fix expiry error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'Fix expiry_date for 100 pallets from Excel data',
    usage: 'POST with { "dry_run": true } to preview, { "dry_run": false } to execute',
    total_pallets: Object.keys(PALLET_EXPIRY_MAP).length
  });
}

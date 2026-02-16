import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same counting as layout-inventory API
const BLK_PALLETS_PER_LOC = 20;

async function fetchPaginated<T>(table: string, select: string, filters?: (q: any) => any, orderBy: string = 'id'): Promise<T[]> {
  const result: T[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    let q = supabase.from(table).select(select).order(orderBy, { ascending: true }).range(page * size, (page + 1) * size - 1);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    result.push(...(data as T[]));
    if (data.length < size) break;
    page++;
  }
  return result;
}

export async function GET() {
  try {
    const DAYS = 10;

    // ── 1. Master locations (rack + floor + dispatch for MR/PQ) ──
    const allLocations = await fetchPaginated<{
      location_id: string; location_type: string; shelf: string | null; aisle: string | null; zone: string | null; max_capacity_qty: number | null;
    }>('master_location', 'location_id, location_type, shelf, aisle, zone, max_capacity_qty', q =>
      q.in('location_type', ['rack', 'floor', 'dispatch']).eq('active_status', 'active'),
      'location_id'
    );

    // Build lookup sets from master_location (authoritative source)
    // Exclude A01 shelf=1 (level 1) — used as picking zone, not storage
    const rackLocSet = new Set<string>();
    const blkLocSet = new Set<string>();
    allLocations.forEach(loc => {
      if (loc.location_type === 'rack') {
        if (loc.aisle === 'A01' && loc.shelf === '1') return; // skip A01 level 1
        rackLocSet.add(loc.location_id);
      } else if (loc.location_type === 'floor' && loc.shelf === 'BLK') {
        blkLocSet.add(loc.location_id);
      }
    });

    // Group classifier using lookup sets (not regex)
    function getGroup(locationId: string): 'Rack' | 'BLK' | null {
      if (rackLocSet.has(locationId)) return 'Rack';
      if (blkLocSet.has(locationId)) return 'BLK';
      return null;
    }

    // ── 2. All inventory (same as layout-inventory: total_pack_qty > 0) ──
    const allInventory = await fetchPaginated<{ location_id: string; pallet_id: string | null }>(
      'wms_inventory_balances', 'location_id, pallet_id', q => q.gt('total_pack_qty', 0),
      'balance_id'
    );

    const occupiedSet = new Set(allInventory.map(i => i.location_id));
    const palletCountMap = new Map<string, number>();
    allInventory.forEach(inv => {
      palletCountMap.set(inv.location_id, (palletCountMap.get(inv.location_id) || 0) + 1);
    });

    // ── 3. Count Rack & BLK (for chart) ──
    let rackTotal = 0, rackOccupied = 0;
    let blkTotal = 0, blkOccupied = 0;

    allLocations.forEach(loc => {
      if (loc.location_type === 'rack') {
        if (loc.aisle === 'A01' && loc.shelf === '1') return; // skip A01 level 1
        rackTotal++;
        if (occupiedSet.has(loc.location_id)) rackOccupied++;
      } else if (loc.location_type === 'floor' && loc.shelf === 'BLK') {
        blkTotal += BLK_PALLETS_PER_LOC;
        blkOccupied += palletCountMap.get(loc.location_id) || 0;
      }
    });

    // ── 4. Zone summary (2 sections) ──
    // Section "main": Selective Rack + Block Stack (capacity = 100%)
    // Section "other": MCF, PQ, MR
    const zoneConfig: Record<string, { label: string; section: 'main' | 'other'; storageType: string; productType: string; unit: string; order: number }> = {
      'Zone Selective Rack': { label: 'Selective Rack', section: 'main', storageType: 'Pallet Rack', productType: 'FG, RM (FIFO/FEFO)', unit: 'พาเลท', order: 1 },
      'Zone Block Stack':    { label: 'Block Stack',    section: 'main', storageType: 'Floor/Block', productType: 'FG Bulk, Fast-moving', unit: 'พาเลท', order: 2 },
      'Zone Premium MCF':    { label: 'MCF',            section: 'other', storageType: 'Floor',      productType: 'Premium/MCF', unit: 'พาเลท', order: 3 },
      'PQ':                  { label: 'PQ',             section: 'other', storageType: 'Floor',      productType: 'สินค้าเบิกรอส่ง', unit: 'ใบประหน้า', order: 4 },
      'MR':                  { label: 'MR',             section: 'other', storageType: 'Floor',      productType: 'สินค้าแถมรอส่ง', unit: 'ใบประหน้า', order: 5 },
    };

    const zoneAgg: Record<string, { total: number; occupied: number }> = {};
    allLocations.forEach(loc => {
      let zn = loc.zone as string;
      if (!zn) return;
      if (zn.startsWith('Zone Selective Rack A')) zn = 'Zone Selective Rack';
      if (!zoneConfig[zn]) return;
      if (!zoneAgg[zn]) zoneAgg[zn] = { total: 0, occupied: 0 };

      if (loc.location_type === 'floor' && loc.shelf === 'BLK') {
        zoneAgg[zn].total += BLK_PALLETS_PER_LOC;
        zoneAgg[zn].occupied += palletCountMap.get(loc.location_id) || 0;
      } else if (loc.location_type === 'floor' && (loc.location_id.startsWith('PQ') || loc.location_id.startsWith('MR'))) {
        // PQ/MR locations: use max_capacity_qty (15 picking faces each)
        const capacity = loc.max_capacity_qty || 15;
        zoneAgg[zn].total += capacity;
        // Count occupied picking faces as number of inventory rows for this location
        const occupiedFaces = allInventory.filter(inv => inv.location_id === loc.location_id).length;
        zoneAgg[zn].occupied += Math.min(occupiedFaces, capacity);
      } else {
        if (loc.location_type === 'rack' && loc.aisle === 'A01' && loc.shelf === '1') return; // skip A01 level 1
        zoneAgg[zn].total++;
        if (occupiedSet.has(loc.location_id)) zoneAgg[zn].occupied++;
      }
    });

    const zoneSummaries = Object.entries(zoneAgg)
      .map(([z, agg]) => {
        const cfg = zoneConfig[z];
        const empty = agg.total - agg.occupied;
        const pct = agg.total > 0 ? Math.round((agg.occupied / agg.total) * 1000) / 10 : 0;
        let status = 'ปกติ';
        if (pct >= 90) status = 'วิกฤต';
        else if (pct >= 80) status = 'ใกล้เต็ม';
        return {
          zone: cfg.label, section: cfg.section, storageType: cfg.storageType, productType: cfg.productType,
          totalLocs: agg.total, occupiedLocs: agg.occupied, emptyLocs: empty, pct, status, unit: cfg.unit,
          order: cfg.order,
        };
      })
      .sort((a, b) => a.order - b.order);

    // ── 5. Daily trend ──
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - DAYS);
    const startStr = startDate.toISOString().split('T')[0];

    const ledgerAll = await fetchPaginated<{
      movement_at: string; location_id: string; direction: string; pack_qty: number; pallet_id: string | null;
    }>('wms_inventory_ledger', 'movement_at, location_id, direction, pack_qty, pallet_id', q =>
      q.gte('movement_at', startStr),
      'ledger_id'
    );

    // Find first date with actual ledger data
    let earliestLedgerDate = '';
    ledgerAll.forEach(r => {
      const d = new Date(r.movement_at).toISOString().split('T')[0];
      if (!earliestLedgerDate || d < earliestLedgerDate) earliestLedgerDate = d;
    });

    // Group ledger by date (only Rack/BLK locations)
    const ledgerByDate: Record<string, { location_id: string; direction: string; pack_qty: number; pallet_id: string | null }[]> = {};
    ledgerAll.forEach(row => {
      const grp = getGroup(row.location_id);
      if (!grp) return;
      const day = new Date(row.movement_at).toISOString().split('T')[0];
      if (!ledgerByDate[day]) ledgerByDate[day] = [];
      ledgerByDate[day].push({ location_id: row.location_id, direction: row.direction, pack_qty: Number(row.pack_qty) || 0, pallet_id: row.pallet_id });
    });

    // Build dates newest → oldest
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Current pack_qty sums per location
    const runPackBal: Record<string, number> = {};
    const balAll = await fetchPaginated<{ location_id: string; total_pack_qty: number }>(
      'wms_inventory_balances', 'location_id, total_pack_qty',
      undefined,
      'balance_id'
    );
    balAll.forEach(r => {
      const grp = getGroup(r.location_id);
      if (!grp) return;
      if (grp === 'BLK') {
        const pallets = palletCountMap.get(r.location_id) || 0;
        runPackBal[r.location_id] = Math.max(0, pallets);
      } else if (grp === 'Rack') {
        runPackBal[r.location_id] = Number(r.total_pack_qty) > 0 ? 1 : 0; // binary occupancy
      }
    });

    const resultReverse: { date: string; rack_occ: number; blk_occ: number }[] = [];

    for (const day of dates) {
      let rOcc = 0, bOcc = 0;
      for (const [lid, qty] of Object.entries(runPackBal)) {
        if (qty <= 0) continue;
        const grp = getGroup(lid);
        if (grp === 'Rack') {
          rOcc += runPackBal[lid] > 0 ? 1 : 0;
        } else if (grp === 'BLK' && blkLocSet.has(lid)) {
          bOcc += Math.max(0, runPackBal[lid]);
        }
      }
      resultReverse.push({ date: day, rack_occ: rOcc, blk_occ: bOcc });

      if (ledgerByDate[day]) {
        // Group ledger movements by location+pallet to count distinct pallets (not pack_qty)
        const blkPalletMoves = new Map<string, { direction: string; location_id: string }>();
        const rackMoves: { location_id: string; direction: string; pack_qty: number }[] = [];

        for (const mv of ledgerByDate[day]) {
          const grp = getGroup(mv.location_id);
          if (grp === 'BLK') {
            // Each unique pallet_id per location = 1 pallet move (not pack_qty which is product quantity)
            const key = `${mv.location_id}:${mv.pallet_id || ''}:${mv.direction}`;
            if (!blkPalletMoves.has(key)) {
              blkPalletMoves.set(key, { direction: mv.direction, location_id: mv.location_id });
            }
          } else if (grp === 'Rack') {
            rackMoves.push(mv);
          }
        }

        // Apply BLK moves: 1 pallet per distinct move
        for (const [, mv] of blkPalletMoves) {
          const adj = mv.direction === 'in' ? -1 : 1;
          const next = (runPackBal[mv.location_id] || 0) + adj;
          runPackBal[mv.location_id] = Math.max(0, next);
        }

        // Apply Rack moves: binary occupancy
        for (const mv of rackMoves) {
          const delta = mv.pack_qty > 0 ? 1 : 0;
          const adj = mv.direction === 'in' ? -delta : delta;
          const next = (runPackBal[mv.location_id] || 0) + adj;
          runPackBal[mv.location_id] = Math.max(0, next);
        }
      }
    }

    resultReverse.reverse();

    // Only keep dates from earliest ledger date onward (no flat line before Go-Live)
    const filtered = earliestLedgerDate
      ? resultReverse.filter(r => r.date >= earliestLedgerDate)
      : resultReverse;

    // ── 6. Daily inbound/outbound weight (kg) using RPCs ──
    const dailyWeightMap = new Map<string, { inbound_kg: number; outbound_kg: number }>();
    await Promise.all(filtered.map(async (r) => {
      const [{ data: ibKg }, { data: obKg }] = await Promise.all([
        supabase.rpc('sum_inbound_weight', { date_from: r.date, date_to: r.date }),
        supabase.rpc('sum_outbound_weight', { date_from: r.date, date_to: r.date }),
      ]);
      dailyWeightMap.set(r.date, {
        inbound_kg: Math.round(Number(ibKg) || 0),
        outbound_kg: Math.round(Number(obKg) || 0),
      });
    }));

    const trend = filtered.map(r => {
      const w = dailyWeightMap.get(r.date) || { inbound_kg: 0, outbound_kg: 0 };
      return {
        date: r.date,
        rack_pct: Math.round((r.rack_occ / rackTotal) * 1000) / 10,
        blk_pct: Math.round((r.blk_occ / blkTotal) * 1000) / 10,
        rack_occupied: r.rack_occ,
        rack_empty: rackTotal - r.rack_occ,
        blk_occupied: r.blk_occ,
        blk_empty: blkTotal - r.blk_occ,
        inbound_kg: w.inbound_kg,
        outbound_kg: w.outbound_kg,
      };
    });

    return NextResponse.json({
      trend,
      capacity: {
        rack_total: rackTotal,
        rack_occupied: rackOccupied,
        rack_empty: rackTotal - rackOccupied,
        rack_pct: Math.round((rackOccupied / rackTotal) * 1000) / 10,
        blk_total: blkTotal,
        blk_occupied: blkOccupied,
        blk_empty: blkTotal - blkOccupied,
        blk_pct: Math.round((blkOccupied / blkTotal) * 1000) / 10,
      },
      zones: zoneSummaries,
    });
  } catch (error: any) {
    console.error('Capacity trend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

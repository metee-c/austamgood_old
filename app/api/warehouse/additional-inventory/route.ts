import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchPaginated<T>(table: string, select: string, filters?: (q: any) => any): Promise<T[]> {
  const result: T[] = [];
  let page = 0;
  const size = 1000;
  while (true) {
    let q = supabase.from(table).select(select).range(page * size, (page + 1) * size - 1);
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
    // Get last 3 days (today + prev 2) of inventory movements for PK001 and A09/A10 level 1
    const dates = [
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      new Date(),
    ];
    const dateStrs = dates.map(d => d.toISOString().split('T')[0]);
    const startStr = dateStrs[0];

    // Fetch ledger movements
    const ledgerData = await fetchPaginated<{
      movement_at: string; location_id: string; direction: string; pack_qty: number; pallet_id: string | null;
    }>('wms_inventory_ledger', 'movement_at, location_id, direction, pack_qty, pallet_id', q =>
      q.gte('movement_at', startStr)
        .or('location_id.eq.PK001,location_id.like.A09-01%,location_id.like.A10-01%')
        .order('movement_at', { ascending: false })
    );

    // Group by date (string) and location, counting UNIQUE pallet_id (1 pallet_id = 1 pallet). If pallet_id null, count as 1.
    const dailyData: Record<string, Record<string, number>> = {};
    const seen: Record<string, Set<string>> = {};
    ledgerData.forEach(row => {
      const day = new Date(row.movement_at).toISOString().split('T')[0];
      if (!dateStrs.includes(day)) return;
      if (!dailyData[day]) dailyData[day] = {};
      if (!dailyData[day][row.location_id]) dailyData[day][row.location_id] = 0;
      if (row.direction === 'in') {
        const key = row.pallet_id ? row.pallet_id : `null-${day}-${row.location_id}-${Math.random()}`;
        if (!seen[day]) seen[day] = new Set();
        // Only count once per pallet_id per day/location
        const dedupKey = `${row.location_id}|${key}`;
        if (!seen[day].has(dedupKey)) {
          seen[day].add(dedupKey);
          dailyData[day][row.location_id] += 1;
        }
      }
    });

    // Build final data structure (use raw daily sums; negative means net outflow)
    const locations = ['PK001', ...Array.from({ length: 26 }, (_, i) => `A09-01-${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 26 }, (_, i) => `A10-01-${String(i + 1).padStart(3, '0')}`)];
    
    const result = locations.map(loc => {
      const dailyPallets: Record<string, number> = {};
      dateStrs.forEach(d => {
        dailyPallets[d] = Math.round(dailyData[d]?.[loc] || 0);
      });
      return {
        location: loc,
        dailyPallets,
        currentPallets: 0,
      };
    });

    return NextResponse.json({
      data: result,
      dates: dateStrs,
    });
  } catch (error: any) {
    console.error('Additional inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

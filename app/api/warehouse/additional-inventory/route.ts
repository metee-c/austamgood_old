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
    // Get last 3 days of inventory movements for PK001 and A09/A10 level 1
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    const startStr = startDate.toISOString().split('T')[0];

    // Fetch ledger movements
    const ledgerData = await fetchPaginated<{
      movement_at: string; location_id: string; direction: string; pack_qty: number;
    }>('wms_inventory_ledger', 'movement_at, location_id, direction, pack_qty', q =>
      q.gte('movement_at', startStr)
        .in('location_id', ['PK001'])
        .or('location_id.like.A09-01%')
        .or('location_id.like.A10-01%')
        .order('movement_at', { ascending: false })
    );

    // Group by date and location
    const dailyData: Record<string, Record<string, number>> = {};
    ledgerData.forEach(row => {
      const day = new Date(row.movement_at).toISOString().split('T')[0];
      if (!dailyData[day]) dailyData[day] = {};
      if (!dailyData[day][row.location_id]) dailyData[day][row.location_id] = 0;
      dailyData[day][row.location_id] += row.direction === 'in' ? row.pack_qty : -row.pack_qty;
    });

    // Get current inventory balances
    const currentBalances = await fetchPaginated<{
      location_id: string; total_pack_qty: number;
    }>('wms_inventory_balances', 'location_id, total_pack_qty', q =>
      q.in('location_id', ['PK001'])
        .or('location_id.like.A09-01%')
        .or('location_id.like.A10-01%')
        .gt('total_pack_qty', 0)
    );

    const currentMap = new Map<string, number>();
    currentBalances.forEach(b => {
      currentMap.set(b.location_id, Number(b.total_pack_qty) || 0);
    });

    // Build final data structure
    const locations = ['PK001', ...Array.from({ length: 26 }, (_, i) => `A09-01-${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 26 }, (_, i) => `A10-01-${String(i + 1).padStart(3, '0')}`)];
    
    const result = locations.map(loc => {
      const dailyPallets: Record<string, number> = {};
      
      // Calculate backwards from today
      for (let i = 0; i < 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        let pallets = currentMap.get(loc) || 0;
        
        // Apply movements for this date and earlier dates
        for (let j = 0; j <= i; j++) {
          const checkDate = new Date();
          checkDate.setDate(checkDate.getDate() - j);
          const checkDateStr = checkDate.toISOString().split('T')[0];
          
          if (dailyData[checkDateStr] && dailyData[checkDateStr][loc]) {
            pallets -= dailyData[checkDateStr][loc];
          }
        }
        
        dailyPallets[dateStr] = Math.max(0, Math.round(pallets));
      }
      
      return {
        location: loc,
        dailyPallets,
        currentPallets: currentMap.get(loc) || 0,
      };
    });

    return NextResponse.json({
      data: result,
      dates: [
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
      ],
    });
  } catch (error: any) {
    console.error('Additional inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

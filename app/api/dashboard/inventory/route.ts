import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // ────────────────────────────────────────────────────────────────
    // 1. KPI SUMMARY (4 cards)
    // ────────────────────────────────────────────────────────────────
    const { data: balances, error: balErr } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, sku_id, location_id, pallet_id, total_pack_qty, production_date');

    if (balErr) throw new Error(`Balances query failed: ${balErr.message}`);

    // Filter: Only SKUs starting with "B-" or "00-"
    const activeBalances = (balances || []).filter(b => {
      if (b.total_pack_qty <= 0) return false;
      const skuId = b.sku_id || '';
      return skuId.startsWith('B-') || skuId.startsWith('00-');
    });

    // For KPIs, Category, Turnover: Only "B-" SKUs
    const bOnlyBalances = activeBalances.filter(b => (b.sku_id || '').startsWith('B-'));
    const totalSkus = new Set(bOnlyBalances.map(b => b.sku_id)).size;
    const totalPallets = new Set(bOnlyBalances.map(b => b.pallet_id).filter(Boolean)).size;
    const totalLocations = new Set(bOnlyBalances.map(b => b.location_id)).size;

    // Get SKU weights to calculate total weight
    const { data: skus, error: skuErr } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, weight_per_pack_kg, abc_class, safety_stock, reorder_point, category');

    if (skuErr) throw new Error(`SKU query failed: ${skuErr.message}`);

    const skuMap = new Map((skus || []).map(s => [s.sku_id, s]));

    let totalWeightKg = 0;
    bOnlyBalances.forEach(b => {
      const sku = skuMap.get(b.sku_id);
      if (sku && sku.weight_per_pack_kg) {
        totalWeightKg += Number(b.total_pack_qty) * Number(sku.weight_per_pack_kg);
      }
    });

    const kpis = {
      total_skus: totalSkus,
      total_pallets: totalPallets,
      total_weight_tons: Math.round(totalWeightKg / 1000 * 10) / 10,
      total_locations: totalLocations,
    };

    // ────────────────────────────────────────────────────────────────
    // 2. AGING REPORT (donut chart + table) - Use ALL (B- + 00-)
    // ────────────────────────────────────────────────────────────────
    const agingBrackets = [
      { label: '0-30 วัน', min: 0, max: 30 },
      { label: '31-60 วัน', min: 31, max: 60 },
      { label: '61-90 วัน', min: 61, max: 90 },
      { label: '90+ วัน', min: 91, max: 99999 },
    ];

    const agingData = agingBrackets.map(bracket => {
      const items = activeBalances.filter(b => { // Use activeBalances (B- + 00-)
        if (!b.production_date) return false;
        const age = Math.floor((today.getTime() - new Date(b.production_date).getTime()) / (1000 * 60 * 60 * 24));
        return age >= bracket.min && age <= bracket.max;
      });

      const skuSet = new Set(items.map(i => i.sku_id));
      const palletSet = new Set(items.map(i => i.pallet_id).filter(Boolean));

      let weightKg = 0;
      items.forEach(b => {
        const sku = skuMap.get(b.sku_id);
        if (sku && sku.weight_per_pack_kg) {
          weightKg += Number(b.total_pack_qty) * Number(sku.weight_per_pack_kg);
        }
      });

      // Get top SKUs in this bracket
      const skuDetails = new Map<string, { name: string; qty: number; pallets: number; weight_kg: number }>();
      items.forEach(b => {
        const sku = skuMap.get(b.sku_id);
        if (!sku) return;

        const existing = skuDetails.get(b.sku_id) || { name: sku.sku_name || b.sku_id, qty: 0, pallets: 0, weight_kg: 0 };
        existing.qty += Number(b.total_pack_qty);
        existing.pallets += 1;
        if (sku.weight_per_pack_kg) {
          existing.weight_kg += Number(b.total_pack_qty) * Number(sku.weight_per_pack_kg);
        }
        skuDetails.set(b.sku_id, existing);
      });

      const topSkus = Array.from(skuDetails.entries())
        .map(([sku_id, details]) => ({ sku_id, ...details }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      return {
        bracket: bracket.label,
        sku_count: skuSet.size,
        pallet_count: palletSet.size,
        weight_kg: Math.round(weightKg),
        top_skus: topSkus,
      };
    });

    // ────────────────────────────────────────────────────────────────
    // 3. CATEGORY BREAKDOWN (by ABC class) - Only "B-" SKUs
    // ────────────────────────────────────────────────────────────────
    const abcClasses = ['A', 'B', 'C', 'unclassified'];
    const categoryData = abcClasses.map(cls => {
      const items = bOnlyBalances.filter(b => { // Use bOnlyBalances (B- only)
        const sku = skuMap.get(b.sku_id);
        if (cls === 'unclassified') {
          return !sku || !sku.abc_class || sku.abc_class.trim() === '';
        }
        return sku && sku.abc_class === cls;
      });

      const skuSet = new Set(items.map(i => i.sku_id));
      let totalPacks = 0;
      let weightKg = 0;

      items.forEach(b => {
        totalPacks += Number(b.total_pack_qty);
        const sku = skuMap.get(b.sku_id);
        if (sku && sku.weight_per_pack_kg) {
          weightKg += Number(b.total_pack_qty) * Number(sku.weight_per_pack_kg);
        }
      });

      return {
        class: cls === 'unclassified' ? 'ไม่ระบุ' : cls,
        sku_count: skuSet.size,
        total_packs: Math.round(totalPacks),
        weight_kg: Math.round(weightKg),
      };
    });

    // ────────────────────────────────────────────────────────────────
    // 4. TURNOVER ANALYSIS (Top 10 / Bottom 10)
    // Use current month data (not 30 days) to match Orders page export
    // IMPORTANT: Use order_date (not delivery_date) to match /api/orders/with-items
    // ────────────────────────────────────────────────────────────────
    // Get first day of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];

    // Query order items with pagination to bypass 1000 row limit
    // Supabase has a hard limit of 1000 rows, so we need to paginate
    let orderItemsRaw: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('wms_order_items')
        .select(`
          sku_id,
          order_qty,
          wms_orders!inner(order_id, order_date, status)
        `)
        .gte('wms_orders.order_date', firstDayStr)
        .lte('wms_orders.order_date', todayStr)
        .in('wms_orders.status', ['picked', 'loaded', 'in_transit', 'delivered'])
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Order items query failed: ${error.message}`);

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        orderItemsRaw = orderItemsRaw.concat(data);
        from += pageSize;
        // Stop if we got less than pageSize (means we're at the end)
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    // Count unique orders for debug
    const orderIds = [...new Set(orderItemsRaw.map((item: any) => item.wms_orders?.order_id).filter(Boolean))];

    // Group outbound by SKU from delivered orders
    // order_qty is already in PACKS (verified from database)
    const outboundMap = new Map<string, number>();
    (orderItemsRaw || []).forEach((item: any) => {
      const skuId = item.sku_id || '';
      // Only SKUs starting with "B-" (NOT 00- for turnover)
      if (!skuId.startsWith('B-')) return;

      const curr = outboundMap.get(skuId) || 0;
      outboundMap.set(skuId, curr + Number(item.order_qty || 0));
    });

    // DEBUG: Log sample data for B-NET-C|FNC|010
    const debugSku = 'B-NET-C|FNC|010';
    const debugQty = outboundMap.get(debugSku);
    console.log(`[INVENTORY DEBUG] SKU ${debugSku}: ${debugQty || 0} packs`);
    console.log(`[INVENTORY DEBUG] Total orders: ${orderIds.length}, Total items: ${orderItemsRaw?.length || 0}`);

    // Get location data to filter by zone
    const { data: locations, error: locErr } = await supabase
      .from('master_location')
      .select('location_id, zone');

    if (locErr) throw new Error(`Locations query failed: ${locErr.message}`);

    // Create location-to-zone map
    const locationZoneMap = new Map((locations || []).map(l => [l.location_id, l.zone]));

    // Get current stock per SKU (Only B- for turnover, only from Zone Selective Rack, Zone Block Stack zones)
    // Also include preparation area (บ้านหยิบ) stock
    const stockMap = new Map<string, number>();

    // Count stock from Zone Selective Rack and Zone Block Stack
    bOnlyBalances.forEach(b => {
      const zoneName = locationZoneMap.get(b.location_id);
      // Allow: Zone Selective Rack, Zone Block Stack, and variants (Zone Selective Rack %)
      if (!zoneName) return;
      if (zoneName === 'Zone Selective Rack' ||
          zoneName === 'Zone Block Stack' ||
          zoneName.startsWith('Zone Selective Rack ')) {
        const curr = stockMap.get(b.sku_id) || 0;
        stockMap.set(b.sku_id, curr + Number(b.total_pack_qty));
      }
    });

    // Add preparation area (บ้านหยิบ) stock
    const { data: prepAreaStock } = await supabase
      .from('vw_preparation_area_inventory')
      .select('sku_id, total_piece_qty, qty_per_pack');

    if (!prepAreaStock) {
      console.warn('No preparation area stock found');
    } else {
      prepAreaStock.forEach((ps: any) => {
        if (!ps.sku_id?.startsWith('B-')) return;
        const qtyPerPack = Number(ps.qty_per_pack) || 1;
        const packQty = Number(ps.total_piece_qty) / qtyPerPack;
        const curr = stockMap.get(ps.sku_id) || 0;
        stockMap.set(ps.sku_id, curr + packQty);
      });
    }

    // Calculate turnover
    const turnoverList: Array<{
      sku_id: string;
      sku_name: string;
      outbound_qty: number;
      current_stock: number;
      turnover_ratio: number;
    }> = [];

    outboundMap.forEach((outQty, skuId) => {
      const sku = skuMap.get(skuId);
      const stock = stockMap.get(skuId) || 0;
      if (sku) {
        turnoverList.push({
          sku_id: skuId,
          sku_name: sku.sku_name || skuId,
          outbound_qty: Math.round(outQty),
          current_stock: Math.round(stock),
          turnover_ratio: stock > 0 ? Math.round((outQty / stock) * 100) / 100 : 0,
        });
      }
    });

    // Top 20 by outbound qty
    const top20 = turnoverList
      .sort((a, b) => b.outbound_qty - a.outbound_qty)
      .slice(0, 20);

    // Bottom 20 (non-zero stock, lowest outbound)
    const bottom20 = turnoverList
      .filter(t => t.current_stock > 0)
      .sort((a, b) => a.outbound_qty - b.outbound_qty)
      .slice(0, 20);

    // ────────────────────────────────────────────────────────────────
    // 5. SAFETY STOCK ALERTS - Use ALL (B- + 00-)
    // ────────────────────────────────────────────────────────────────
    // Build stock map for ALL SKUs (B- + 00-)
    const allStockMap = new Map<string, number>();
    activeBalances.forEach(b => {
      const curr = allStockMap.get(b.sku_id) || 0;
      allStockMap.set(b.sku_id, curr + Number(b.total_pack_qty));
    });

    const safetyAlerts: Array<{
      sku_id: string;
      sku_name: string;
      current_qty: number;
      safety_stock: number;
      reorder_point: number;
      status: string;
    }> = [];

    allStockMap.forEach((qty, skuId) => { // Use allStockMap (B- + 00-)
      const sku = skuMap.get(skuId);
      if (sku && (sku.safety_stock || sku.reorder_point)) {
        const safety = Number(sku.safety_stock) || 0;
        const reorder = Number(sku.reorder_point) || 0;

        let status = '';
        if (safety > 0 && qty < safety) status = 'below_safety';
        else if (reorder > 0 && qty < reorder) status = 'below_reorder';

        if (status) {
          safetyAlerts.push({
            sku_id: skuId,
            sku_name: sku.sku_name || skuId,
            current_qty: Math.round(qty),
            safety_stock: safety,
            reorder_point: reorder,
            status,
          });
        }
      }
    });

    // ────────────────────────────────────────────────────────────────
    // 6. SLOW/DEAD STOCK (no movement in 60+ days)
    // ────────────────────────────────────────────────────────────────
    const date60ago = new Date(today);
    date60ago.setDate(date60ago.getDate() - 60);
    const date60str = date60ago.toISOString().split('T')[0];

    const { data: recentMovesRaw, error: recentErr } = await supabase
      .from('wms_inventory_ledger')
      .select('sku_id, movement_at')
      .eq('direction', 'out')
      .gte('movement_at', date60str);

    if (recentErr) throw new Error(`Recent moves query failed: ${recentErr.message}`);

    // Filter recent moves: Only SKUs starting with "B-" (NOT 00- for slow/dead)
    const recentMoves = (recentMovesRaw || []).filter(m => {
      const skuId = m.sku_id || '';
      return skuId.startsWith('B-');
    });

    const recentSkuSet = new Set(recentMoves.map(m => m.sku_id));

    // Get last movement for slow/dead SKUs (Only B- SKUs)
    const slowSkus = Array.from(stockMap.keys()).filter(skuId => !recentSkuSet.has(skuId));

    const slowDeadStock: Array<{
      sku_id: string;
      sku_name: string;
      current_qty: number;
      last_movement_date: string | null;
      days_since_movement: number | null;
    }> = [];

    for (const skuId of slowSkus) {
      const sku = skuMap.get(skuId);
      if (!sku) continue;

      // Get last movement for this SKU
      const { data: lastMove } = await supabase
        .from('wms_inventory_ledger')
        .select('movement_at')
        .eq('sku_id', skuId)
        .eq('direction', 'out')
        .order('movement_at', { ascending: false })
        .limit(1)
        .single();

      let lastDate = null;
      let daysSince = null;

      if (lastMove && lastMove.movement_at) {
        lastDate = new Date(lastMove.movement_at).toISOString().split('T')[0];
        daysSince = Math.floor((today.getTime() - new Date(lastMove.movement_at).getTime()) / (1000 * 60 * 60 * 24));
      }

      slowDeadStock.push({
        sku_id: skuId,
        sku_name: sku.sku_name || skuId,
        current_qty: Math.round(stockMap.get(skuId) || 0),
        last_movement_date: lastDate,
        days_since_movement: daysSince,
      });
    }

    // Sort by days since movement DESC
    slowDeadStock.sort((a, b) => (b.days_since_movement || 0) - (a.days_since_movement || 0));

    // ────────────────────────────────────────────────────────────────
    // RESPONSE
    // ────────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        kpis,
        aging: agingData,
        category: categoryData,
        turnover_top20: top20,
        turnover_bottom20: bottom20,
        safety_alerts: safetyAlerts,
        slow_dead_stock: slowDeadStock.slice(0, 50), // Limit to 50 items
        meta: {
          updated: new Date().toISOString(),
          date: todayStr,
        },
      },
    });
  } catch (error: any) {
    console.error('Inventory dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
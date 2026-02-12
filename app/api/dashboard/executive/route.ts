import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerFilter = searchParams.get('customer') || '';
  const statusFilter = searchParams.get('status') || '';
  const yearFilter = searchParams.get('year') || '';
  const monthFilter = searchParams.get('month') || '';

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Helper: date ranges
    const dayStart = (d: string) => d;
    const dayEnd = (d: string) => d + 'T23:59:59';
    const monthStart = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;
    const monthEnd = (y: number, m: number) => {
      const last = new Date(y, m, 0);
      return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}T23:59:59`;
    };

    // ── KPI QUERIES (WEIGHT in kg) ──

    // Helper: Get receive_ids for date range
    const getReceiveIdsForDateRange = async (start: string, end?: string) => {
      let query = supabase.from('wms_receives').select('receive_id').gte('receive_date', start);
      if (end) query = query.lte('receive_date', end);
      const { data } = await query;
      return data?.map(r => r.receive_id) || [];
    };

    // MTD Inbound Weight
    const mtdReceiveIds = await getReceiveIdsForDateRange(monthStart(currentYear, currentMonth));
    let mtdInbound = 0;
    if (mtdReceiveIds.length > 0) {
      const { data } = await supabase.from('wms_receive_items')
        .select('weight_kg')
        .in('receive_id', mtdReceiveIds);
      mtdInbound = data?.reduce((sum, r) => sum + (r.weight_kg || 0), 0) || 0;
    }

    // Last month inbound weight (same period)
    const dayOfMonth = now.getDate();
    const lastMtdReceiveIds = await getReceiveIdsForDateRange(
      monthStart(currentYear, currentMonth - 1),
      `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}T23:59:59`
    );
    let lastMtdInbound = 0;
    if (lastMtdReceiveIds.length > 0) {
      const { data } = await supabase.from('wms_receive_items')
        .select('weight_kg')
        .in('receive_id', lastMtdReceiveIds);
      lastMtdInbound = data?.reduce((sum, r) => sum + (r.weight_kg || 0), 0) || 0;
    }

    // MTD Outbound Weight - use RPC to avoid row limit
    const { data: mtdObResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: monthStart(currentYear, currentMonth).split('T')[0],
    });
    const mtdOutbound = Number(mtdObResult) || 0;

    const lastMtdEnd = `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    const { data: lastMtdObResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: monthStart(currentYear, currentMonth - 1).split('T')[0],
      date_to: lastMtdEnd,
    });
    const lastMtdOutbound = Number(lastMtdObResult) || 0;

    // YTD Inbound Weight
    const ytdReceiveIds = await getReceiveIdsForDateRange(`${currentYear}-01-01`, dayEnd(now.toISOString().split('T')[0]));
    let ytdInbound = 0;
    if (ytdReceiveIds.length > 0) {
      const { data } = await supabase.from('wms_receive_items')
        .select('weight_kg')
        .in('receive_id', ytdReceiveIds);
      ytdInbound = data?.reduce((sum, r) => sum + (r.weight_kg || 0), 0) || 0;
    }

    // YTD Outbound Weight - use RPC
    const { data: ytdObResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: `${currentYear}-01-01`,
    });
    const ytdOutbound = Number(ytdObResult) || 0;

    // Backlog
    const { count: backlogInbound } = await supabase.from('wms_receives')
      .select('*', { count: 'exact', head: true })
      .in('status', ['รอรับเข้า', 'กำลังตรวจสอบ']);
    const { count: backlogOutbound } = await supabase.from('wms_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['confirmed', 'in_picking', 'picked']);
    const backlog = (backlogInbound || 0) + (backlogOutbound || 0);

    // OTIF (30 days)
    const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const { data: deliveredAll } = await supabase.from('wms_orders')
      .select('order_id, delivery_date, updated_at')
      .eq('status', 'delivered')
      .gte('updated_at', thirtyAgo.toISOString().split('T')[0]);
    let otifOnTime = 0;
    deliveredAll?.forEach(o => {
      if (o.delivery_date && o.updated_at) {
        if (new Date(o.updated_at) <= new Date(o.delivery_date)) otifOnTime++;
      }
    });
    const otifRate = deliveredAll?.length ? (otifOnTime / deliveredAll.length) * 100 : 0;

    // ── MONTHLY DATA - WEIGHT (12 months of current year: Jan-Dec) ──
    const monthlyData = [];
    const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    for (let m = 1; m <= 12; m++) {
      const ms = monthStart(currentYear, m);
      const me = monthEnd(currentYear, m);

      // Get inbound weight for this month
      const monthReceiveIds = await getReceiveIdsForDateRange(ms, me);
      let ib = 0;
      if (monthReceiveIds.length > 0) {
        const { data } = await supabase.from('wms_receive_items')
          .select('weight_kg')
          .in('receive_id', monthReceiveIds);
        ib = data?.reduce((sum, r) => sum + (r.weight_kg || 0), 0) || 0;
      }

      const msDate = `${currentYear}-${String(m).padStart(2, '0')}-01`;
      const meDate = `${currentYear}-${String(m).padStart(2, '0')}-${String(new Date(currentYear, m, 0).getDate()).padStart(2, '0')}`;
      const { data: obResult } = await supabase.rpc('sum_outbound_weight', {
        date_from: msDate,
        date_to: meDate,
      });
      const ob = Number(obResult) || 0;

      monthlyData.push({ month: monthNames[m - 1], year: currentYear, inbound: Math.round(ib), outbound: Math.round(ob) });
    }

    // ── DAILY TREND (10 days) - WEIGHT with type breakdowns ──
    const dailyData = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];

      // Inbound by type using RPC
      const { data: ibTypes } = await supabase.rpc('daily_inbound_by_type', {
        date_from: ds,
        date_to: dayEnd(ds),
      });
      const ibBreakdown: Record<string, number> = {};
      let ibTotal = 0;
      (ibTypes || []).forEach((r: any) => {
        const w = Number(r.weight) || 0;
        ibBreakdown[r.receive_type] = w;
        ibTotal += w;
      });

      // Outbound by type using RPC
      const { data: obTypes } = await supabase.rpc('daily_outbound_by_type', {
        target_date: ds,
      });
      const obBreakdown: Record<string, number> = {};
      let obTotal = 0;
      (obTypes || []).forEach((r: any) => {
        const w = Number(r.weight) || 0;
        obBreakdown[r.order_type] = w;
        obTotal += w;
      });

      dailyData.push({
        date: ds,
        inbound: Math.round(ibTotal),
        outbound: Math.round(obTotal),
        inbound_types: ibBreakdown,
        outbound_types: obBreakdown,
      });
    }

    // ── PROVINCE DATA - WEIGHT + ORDER COUNT ──
    const { data: provinceRaw } = await supabase.from('wms_orders')
      .select('province, status, total_weight')
      .gte('created_at', monthStart(currentYear, currentMonth))
      .not('province', 'is', null);
    const provMap = new Map<string, { count: number; totalWeight: number; deliveredWeight: number }>();
    provinceRaw?.forEach(o => {
      if (!o.province) return;
      const p = provMap.get(o.province) || { count: 0, totalWeight: 0, deliveredWeight: 0 };
      p.count++;
      p.totalWeight += o.total_weight || 0;
      if (o.status === 'delivered') p.deliveredWeight += o.total_weight || 0;
      provMap.set(o.province, p);
    });
    const provinceData = Array.from(provMap.entries())
      .map(([name, d]) => ({ name, orders: d.count, weight: Math.round(d.totalWeight), delivered: Math.round(d.deliveredWeight) }))
      .sort((a, b) => b.weight - a.weight);

    // ── TOP 10 CUSTOMERS ──
    const { data: custRaw } = await supabase.from('wms_orders')
      .select('customer_id, order_id, province, status, total_qty, total_weight')
      .gte('created_at', monthStart(currentYear, currentMonth))
      .not('status', 'eq', 'cancelled');
    const custMap = new Map<string, { orders: number; qty: number; weight: number; fulfilled: number; orderIds: number[] }>();
    custRaw?.forEach(o => {
      const c = custMap.get(o.customer_id) || { orders: 0, qty: 0, weight: 0, fulfilled: 0, orderIds: [] };
      c.orders++;
      c.qty += o.total_qty || 0;
      c.weight += o.total_weight || 0;
      if (['loaded', 'in_transit', 'delivered'].includes(o.status)) c.fulfilled++;
      c.orderIds.push(o.order_id);
      custMap.set(o.customer_id, c);
    });
    const topCustIds = Array.from(custMap.entries())
      .sort((a, b) => b[1].orders - a[1].orders).slice(0, 10).map(([id]) => id);

    // Get customer names from master_customer (singular)
    const custNameMap = new Map<string, string>();
    if (topCustIds.length > 0) {
      const { data: custNames } = await supabase.from('master_customer')
        .select('customer_id, customer_name')
        .in('customer_id', topCustIds);
      custNames?.forEach(c => custNameMap.set(c.customer_id, c.customer_name || ''));
    }

    // Get truck count & shipping cost per customer via order_id -> route_stops -> trips
    const truckMap = new Map<string, { trucks: number; cost: number }>();
    if (topCustIds.length > 0) {
      // Collect all order_ids for top customers
      const allOrderIds: number[] = [];
      topCustIds.forEach(id => {
        const c = custMap.get(id);
        if (c) allOrderIds.push(...c.orderIds);
      });

      if (allOrderIds.length > 0) {
        // Get route stops linked to these orders (customer_id is null, use order_id)
        const { data: routeStops } = await supabase.from('receiving_route_stops')
          .select('order_id, trip_id')
          .in('order_id', allOrderIds.slice(0, 500));

        if (routeStops && routeStops.length > 0) {
          const tripIds = [...new Set(routeStops.map(s => s.trip_id))];

          // Get trips with shipping costs
          const { data: trips } = await supabase.from('receiving_route_trips')
            .select('trip_id, shipping_cost, plan_id')
            .in('trip_id', tripIds);

          // Filter by plan_date this month
          const planIds = [...new Set(trips?.map(t => t.plan_id) || [])];
          const { data: plans } = await supabase.from('receiving_route_plans')
            .select('plan_id, plan_date')
            .in('plan_id', planIds)
            .gte('plan_date', monthStart(currentYear, currentMonth));
          const validPlanIds = new Set(plans?.map(p => p.plan_id) || []);

          const validTrips = new Map<number, number>();
          trips?.forEach(t => {
            if (validPlanIds.has(t.plan_id)) {
              validTrips.set(t.trip_id, t.shipping_cost || 0);
            }
          });

          // Build order_id -> customer_id map
          const orderCustMap = new Map<number, string>();
          topCustIds.forEach(id => {
            custMap.get(id)?.orderIds.forEach(oid => orderCustMap.set(oid, id));
          });

          // Count distinct trips per customer
          const custTripSets = new Map<string, Set<number>>();
          routeStops.forEach(s => {
            if (!validTrips.has(s.trip_id)) return;
            const custId = orderCustMap.get(s.order_id);
            if (!custId) return;
            if (!custTripSets.has(custId)) custTripSets.set(custId, new Set());
            custTripSets.get(custId)!.add(s.trip_id);
          });
          custTripSets.forEach((tripSet, custId) => {
            let totalCost = 0;
            tripSet.forEach(tripId => { totalCost += validTrips.get(tripId) || 0; });
            truckMap.set(custId, { trucks: tripSet.size, cost: totalCost });
          });
        }
      }
    }

    const topCustomers = topCustIds.map(id => {
      const d = custMap.get(id)!;
      const route = truckMap.get(id) || { trucks: 0, cost: 0 };
      return {
        id,
        name: custNameMap.get(id) || '',
        orders: d.orders,
        qty: d.qty,
        weight: d.weight,
        fulfillment: d.orders ? (d.fulfilled / d.orders) * 100 : 0,
        trucks: route.trucks,
        shipping_cost: route.cost,
      };
    });

    // ── STATUS BREAKDOWN ──
    const { data: statusRaw } = await supabase.from('wms_orders')
      .select('status')
      .gte('created_at', monthStart(currentYear, currentMonth))
      .not('status', 'eq', 'cancelled');
    const statusMap = new Map<string, number>();
    statusRaw?.forEach(o => statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1));
    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // ── FILTER OPTIONS ──
    const { data: customers } = await supabase.from('master_customer')
      .select('customer_id, customer_name').limit(200);
    const provOptions = [...new Set(provinceRaw?.map(o => o.province).filter(Boolean))].sort();

    // ── BUILD RESPONSE ──
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const monthLabel = `${thaiMonths[currentMonth - 1]} ${currentYear}`;

    return NextResponse.json({
      data: {
        kpis: {
          inbound: { actual: Math.round(mtdInbound), goal: Math.max(Math.round(lastMtdInbound), 1), prev: Math.round(lastMtdInbound), label: `สินค้าเข้า ${monthLabel} (กก.)` },
          outbound: { actual: Math.round(mtdOutbound), goal: Math.max(Math.round(lastMtdOutbound), 1), prev: Math.round(lastMtdOutbound), label: `สินค้าออก ${monthLabel} (กก.)` },
          ytd_inbound: { actual: Math.round(ytdInbound), goal: 0, prev: 0, label: `สะสมเข้า ปี ${currentYear} (กก.)` },
          ytd_outbound: { actual: Math.round(ytdOutbound), goal: 0, prev: 0, label: `สะสมออก ปี ${currentYear} (กก.)` },
          backlog: { actual: backlog, goal: 30, prev: backlog, label: 'งานค้าง' },
          otif: { actual: Math.round(otifRate * 10) / 10, goal: 85, prev: 85, label: 'ส่งตรงเวลา %' },
        },
        monthly: monthlyData,
        daily: dailyData,
        provinces: provinceData,
        top_customers: topCustomers,
        status_breakdown: statusBreakdown,
        filters: {
          customers: customers?.map(c => ({ id: c.customer_id, name: c.customer_name })) || [],
          provinces: provOptions,
          years: [currentYear, currentYear - 1],
        },
        meta: { updated: new Date().toISOString(), year: currentYear, month: currentMonth },
      },
    });
  } catch (error) {
    console.error('Executive API Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const dayEnd = (d: string) => d + 'T23:59:59';
    const monthStartStr = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;
    const fmtDate = (d: string) => {
      const [y, m, dd] = d.split('-');
      return `${dd}/${m}/${y}`;
    };

    // ══════════════════════════════════════════════════
    // SECTION: top5 — lightweight fetch for Top 5 tables
    // ══════════════════════════════════════════════════
    if (section === 'top5') {
      const from = dateFrom || todayStr;
      const to = dateTo || todayStr;
      const hasRange = from !== to;

      const { data: topIbRaw } = await supabase.rpc('top_inbound_today', {
        target_date: from,
        ...(hasRange ? { p_date_to: to } : {}),
      });
      const topInboundToday = (topIbRaw || []).map((r: any) => ({
        sku_id: r.sku_id, product_name: r.product_name,
        packs: Math.round(r.packs), weight_kg: Math.round(r.weight_kg),
      }));

      const { data: topObRaw } = await supabase.rpc('top_outbound_today', {
        target_date: from,
        ...(hasRange ? { p_date_to: to } : {}),
      });
      const topOutboundToday = (topObRaw || []).map((r: any) => ({
        sku_id: r.sku_id, product_name: r.product_name,
        packs: Math.round(r.packs), weight_kg: Math.round(r.weight_kg),
      }));

      const label = hasRange ? `${fmtDate(from)} - ${fmtDate(to)}` : 'วันนี้';

      return NextResponse.json({
        top_inbound_today: topInboundToday,
        top_outbound_today: topOutboundToday,
        top5_label: label,
      });
    }

    // ══════════════════════════════════════════════════
    // SECTION: provinces — lightweight fetch for heatmap
    // ══════════════════════════════════════════════════
    if (section === 'provinces') {
      const from = dateFrom || monthStartStr(currentYear, currentMonth);
      const to = dateTo || todayStr;

      const { data: provinceRaw } = await supabase.from('wms_orders')
        .select('province, status, total_weight')
        .gte('delivery_date', from)
        .lte('delivery_date', to)
        .in('status', ['loaded', 'in_transit', 'delivered'])
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
      const provinces = Array.from(provMap.entries())
        .map(([name, d]) => ({ name, orders: d.count, weight: Math.round(d.totalWeight), delivered: Math.round(d.deliveredWeight) }))
        .sort((a, b) => b.weight - a.weight);

      return NextResponse.json({ provinces });
    }

    // ══════════════════════════════════════════════════
    // DEFAULT: Full dashboard data (no filters)
    // ══════════════════════════════════════════════════

    // Fixed ranges (no user filter)
    const rangeFrom = monthStartStr(currentYear, currentMonth);
    const rangeTo = todayStr;

    // Previous period: full previous month
    const prevMonth = currentMonth - 1 <= 0 ? 12 : currentMonth - 1;
    const prevYear = currentMonth - 1 <= 0 ? currentYear - 1 : currentYear;
    const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevFrom = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevTo = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevMonthLastDay).padStart(2, '0')}`;
    const prevLabel = `จากเดือน${thaiMonths[prevMonth - 1]} ${prevYear}`;

    // ── KPI QUERIES ──
    const { data: ibResult } = await supabase.rpc('sum_inbound_weight', {
      date_from: rangeFrom, date_to: rangeTo,
    });
    const rangeInbound = Number(ibResult) || 0;

    const { data: prevIbResult } = await supabase.rpc('sum_inbound_weight', {
      date_from: prevFrom, date_to: prevTo,
    });
    const prevInbound = Number(prevIbResult) || 0;

    const { data: obResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: rangeFrom, date_to: rangeTo,
    });
    const rangeOutbound = Number(obResult) || 0;

    const { data: prevObResult } = await supabase.rpc('sum_outbound_weight', {
      date_from: prevFrom, date_to: prevTo,
    });
    const prevOutbound = Number(prevObResult) || 0;

    // YTD
    const { data: ytdIbResult } = await supabase.rpc('sum_inbound_weight', {
      date_from: `${currentYear}-01-01`,
    });
    const ytdInbound = Number(ytdIbResult) || 0;

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

    // OTIF (last 30 days)
    const thirtyAgo = new Date(now);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
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

    // ── MONTHLY DATA (12 months) ──
    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const msDate = `${currentYear}-${String(m).padStart(2, '0')}-01`;
      const meDate = `${currentYear}-${String(m).padStart(2, '0')}-${String(new Date(currentYear, m, 0).getDate()).padStart(2, '0')}`;
      const { data: mIb } = await supabase.rpc('sum_inbound_weight', { date_from: msDate, date_to: meDate });
      const { data: mOb } = await supabase.rpc('sum_outbound_weight', { date_from: msDate, date_to: meDate });
      monthlyData.push({ month: monthNames[m - 1], year: currentYear, inbound: Math.round(Number(mIb) || 0), outbound: Math.round(Number(mOb) || 0) });
    }

    // ── DAILY TREND (last 10 days) ──
    const dailyData = [];
    const dailyEnd = new Date(now);
    const dailyStart = new Date(now);
    dailyStart.setDate(dailyStart.getDate() - 9);
    for (let d = new Date(dailyStart); d <= dailyEnd; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const { data: ibTypes } = await supabase.rpc('daily_inbound_by_type', {
        date_from: ds, date_to: dayEnd(ds),
      });
      const ibBreakdown: Record<string, number> = {};
      let ibTotal = 0;
      (ibTypes || []).forEach((r: any) => {
        const w = Number(r.weight) || 0;
        ibBreakdown[r.receive_type] = w;
        ibTotal += w;
      });

      const { data: obTypes } = await supabase.rpc('daily_outbound_by_type', { target_date: ds });
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

    // ── PROVINCE DATA (current month, same criteria as outbound KPI) ──
    const { data: provinceRaw } = await supabase.from('wms_orders')
      .select('province, status, total_weight')
      .gte('delivery_date', rangeFrom)
      .lte('delivery_date', rangeTo)
      .in('status', ['loaded', 'in_transit', 'delivered'])
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

    // ── TOP 5 INBOUND (today) ──
    const { data: topIbRaw } = await supabase.rpc('top_inbound_today', { target_date: todayStr });
    const topInboundToday = (topIbRaw || []).map((r: any) => ({
      sku_id: r.sku_id, product_name: r.product_name,
      packs: Math.round(r.packs), weight_kg: Math.round(r.weight_kg),
    }));

    // ── TOP 5 OUTBOUND (today) ──
    const { data: topObRaw } = await supabase.rpc('top_outbound_today', { target_date: todayStr });
    const topOutboundToday = (topObRaw || []).map((r: any) => ({
      sku_id: r.sku_id, product_name: r.product_name,
      packs: Math.round(r.packs), weight_kg: Math.round(r.weight_kg),
    }));

    // ── STATUS BREAKDOWN ──
    const { data: statusRaw } = await supabase.from('wms_orders')
      .select('status')
      .gte('created_at', rangeFrom)
      .lte('created_at', dayEnd(rangeTo))
      .not('status', 'eq', 'cancelled');
    const statusMap = new Map<string, number>();
    statusRaw?.forEach(o => statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1));
    const statusBreakdown = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // ── BUILD RESPONSE ──
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    const remainingDays = lastDayOfMonth - now.getDate();
    const monthLabel = `${thaiMonths[currentMonth - 1]} ${currentYear}`;
    const ytdSubtitle = `1/01/${currentYear} ถึง ${fmtDate(todayStr)}`;

    return NextResponse.json({
      data: {
        kpis: {
          inbound: { actual: Math.round(rangeInbound / 100) / 10, goal: Math.max(Math.round(prevInbound / 100) / 10, 0.1), prev: Math.round(prevInbound / 100) / 10, prevLabel, label: `สินค้าเข้า ${monthLabel} (ตัน)`, remainingDays },
          outbound: { actual: Math.round(rangeOutbound / 100) / 10, goal: Math.max(Math.round(prevOutbound / 100) / 10, 0.1), prev: Math.round(prevOutbound / 100) / 10, prevLabel, label: `สินค้าออก ${monthLabel} (ตัน)`, remainingDays },
          ytd_inbound: { actual: Math.round(ytdInbound / 100) / 10, goal: 0, prev: 0, label: `สะสมเข้า ปี ${currentYear} (ตัน)`, subtitle: ytdSubtitle },
          ytd_outbound: { actual: Math.round(ytdOutbound / 100) / 10, goal: 0, prev: 0, label: `สะสมออก ปี ${currentYear} (ตัน)`, subtitle: ytdSubtitle },
          backlog: { actual: backlog, goal: 30, prev: backlog, label: 'งานค้าง' },
          otif: { actual: Math.round(otifRate * 10) / 10, goal: 85, prev: 85, label: 'ส่งตรงเวลา %' },
        },
        monthly: monthlyData,
        daily: dailyData,
        provinces: provinceData,
        top_customers: [],
        top_inbound_today: topInboundToday,
        top_outbound_today: topOutboundToday,
        top5_label: 'วันนี้',
        status_breakdown: statusBreakdown,
        filters: {
          customers: [],
          provinces: [],
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

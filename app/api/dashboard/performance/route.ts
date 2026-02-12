import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';
  const days = period === '30d' ? 30 : 7;

  try {
    const supabase = createServiceRoleClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate date ranges
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - days);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    // ===== INBOUND METRICS =====
    
    // Today's inbound count
    const { data: todayInbound, error: todayInboundError } = await supabase
      .from('wms_receives')
      .select('receive_id, receive_no, status, receive_date')
      .gte('receive_date', todayStr)
      .lte('receive_date', todayStr + 'T23:59:59');

    // Today's pallet count from receive items
    const { data: todayPallets, error: todayPalletsError } = await supabase
      .from('wms_receive_items')
      .select('pallet_id')
      .not('pallet_id', 'is', null)
      .gte('created_at', todayStr)
      .lte('created_at', todayStr + 'T23:59:59');

    // Week inbound count
    const { data: weekInbound, error: weekInboundError } = await supabase
      .from('wms_receives')
      .select('receive_id, status')
      .gte('receive_date', weekAgoStr)
      .lte('receive_date', todayStr + 'T23:59:59');

    // All pending inbound (status = 'รอรับเข้า' or 'กำลังตรวจสอบ')
    const { data: pendingInbound, error: pendingInboundError } = await supabase
      .from('wms_receives')
      .select('receive_id')
      .in('status', ['รอรับเข้า', 'กำลังตรวจสอบ']);

    // Completed inbound (status = 'รับเข้าแล้ว' or 'สำเร็จ')
    const { data: completedInbound, error: completedInboundError } = await supabase
      .from('wms_receives')
      .select('receive_id, receive_date')
      .in('status', ['รับเข้าแล้ว', 'สำเร็จ'])
      .gte('receive_date', weekAgoStr);

    // Inbound status breakdown
    const { data: inboundStatusData, error: inboundStatusError } = await supabase
      .from('wms_receives')
      .select('status')
      .gte('receive_date', weekAgoStr);

    // ===== OUTBOUND METRICS =====

    // Today's outbound (orders with status loaded, in_transit, delivered)
    const { data: todayOutbound, error: todayOutboundError } = await supabase
      .from('wms_orders')
      .select('order_id, order_no, status, delivery_date, updated_at')
      .gte('updated_at', todayStr)
      .in('status', ['loaded', 'in_transit', 'delivered']);

    // Week outbound
    const { data: weekOutbound, error: weekOutboundError } = await supabase
      .from('wms_orders')
      .select('order_id, status, delivery_date, updated_at')
      .gte('updated_at', weekAgoStr)
      .in('status', ['loaded', 'in_transit', 'delivered']);

    // Pending outbound (confirmed, in_picking, picked)
    const { data: pendingOutbound, error: pendingOutboundError } = await supabase
      .from('wms_orders')
      .select('order_id')
      .in('status', ['confirmed', 'in_picking', 'picked']);

    // In transit
    const { data: inTransitOutbound, error: inTransitError } = await supabase
      .from('wms_orders')
      .select('order_id')
      .eq('status', 'in_transit');

    // Delivered for OTIF calculation
    const { data: deliveredOutbound, error: deliveredError } = await supabase
      .from('wms_orders')
      .select('order_id, delivery_date, updated_at')
      .eq('status', 'delivered')
      .gte('updated_at', weekAgoStr);

    // Outbound status breakdown
    const { data: outboundStatusData, error: outboundStatusError } = await supabase
      .from('wms_orders')
      .select('status')
      .gte('created_at', weekAgoStr)
      .not('status', 'eq', 'cancelled');

    // ===== DAILY STATS =====
    const dailyStats = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Count inbound for this date
      const { count: inboundCount } = await supabase
        .from('wms_receives')
        .select('*', { count: 'exact', head: true })
        .gte('receive_date', dateStr)
        .lte('receive_date', dateStr + 'T23:59:59');

      // Count outbound for this date
      const { count: outboundCount } = await supabase
        .from('wms_orders')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', dateStr)
        .in('status', ['loaded', 'in_transit', 'delivered']);

      dailyStats.push({
        date: dateStr,
        inbound_count: inboundCount || 0,
        inbound_qty: 0, // Could be enhanced with actual quantity
        outbound_count: outboundCount || 0,
        outbound_qty: 0,
        completed_rate: 0,
      });
    }

    // Calculate status breakdowns
    const inboundStatusMap = new Map<string, number>();
    inboundStatusData?.forEach(item => {
      const count = inboundStatusMap.get(item.status) || 0;
      inboundStatusMap.set(item.status, count + 1);
    });
    const totalInbound = inboundStatusData?.length || 1;
    const inboundStatusBreakdown = Array.from(inboundStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: (count / totalInbound) * 100,
    }));

    const outboundStatusMap = new Map<string, number>();
    outboundStatusData?.forEach(item => {
      const count = outboundStatusMap.get(item.status) || 0;
      outboundStatusMap.set(item.status, count + 1);
    });
    const totalOutbound = outboundStatusData?.length || 1;
    const outboundStatusBreakdown = Array.from(outboundStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: (count / totalOutbound) * 100,
    }));

    // Calculate OTIF (On Time In Full)
    let onTimeCount = 0;
    deliveredOutbound?.forEach(order => {
      if (order.delivery_date && order.updated_at) {
        const plannedDate = new Date(order.delivery_date);
        const actualDate = new Date(order.updated_at);
        // If delivered on or before planned date, it's on time
        if (actualDate <= plannedDate) {
          onTimeCount++;
        }
      }
    });
    const otifRate = deliveredOutbound?.length ? (onTimeCount / deliveredOutbound.length) * 100 : 0;

    // Calculate completion rate
    const totalProcessed = (completedInbound?.length || 0) + (deliveredOutbound?.length || 0);
    const totalDocuments = (weekInbound?.length || 0) + (weekOutbound?.length || 0);
    const completionRate = totalDocuments ? (totalProcessed / totalDocuments) * 100 : 0;

    // Calculate backlog
    const backlog = (pendingInbound?.length || 0) + (pendingOutbound?.length || 0);

    // Calculate average lead time for outbound (simplified)
    let totalLeadTime = 0;
    let leadTimeCount = 0;
    weekOutbound?.forEach(order => {
      // Estimate: if order was created and now delivered/loaded
      // Using updated_at as proxy for completion time
      if (order.updated_at) {
        // Simplified calculation - would need order_date for accurate lead time
        leadTimeCount++;
        totalLeadTime += 24; // Assume 24 hours as placeholder
      }
    });
    const avgLeadTime = leadTimeCount ? totalLeadTime / leadTimeCount : 24;

    const performanceData = {
      summary: {
        total_inbound: weekInbound?.length || 0,
        total_outbound: weekOutbound?.length || 0,
        backlog,
        completion_rate: completionRate,
        otif_rate: otifRate,
      },
      inbound: {
        today_count: todayInbound?.length || 0,
        today_pallets: todayPallets?.length || 0,
        week_count: weekInbound?.length || 0,
        month_count: weekInbound?.length || 0, // Same as week for now
        pending_count: pendingInbound?.length || 0,
        completed_count: completedInbound?.length || 0,
        avg_processing_hours: 2.5, // Placeholder - would calculate from actual data
        status_breakdown: inboundStatusBreakdown,
      },
      outbound: {
        today_count: todayOutbound?.length || 0,
        today_orders: todayOutbound?.length || 0,
        week_count: weekOutbound?.length || 0,
        month_count: weekOutbound?.length || 0,
        pending_count: pendingOutbound?.length || 0,
        in_transit_count: inTransitOutbound?.length || 0,
        delivered_count: deliveredOutbound?.length || 0,
        otif_rate: otifRate,
        avg_lead_time_hours: avgLeadTime,
        status_breakdown: outboundStatusBreakdown,
      },
      daily_stats: dailyStats,
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json({ data: performanceData });
  } catch (error) {
    console.error('Performance API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}

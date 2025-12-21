/**
 * Throughput Model for Digital Twin
 * 
 * Calculates historical throughput metrics for inbound and outbound operations
 * 
 * Properties validated:
 * - Property 5: Demand Multiplier Application
 */

import { createClient } from '@/lib/supabase/server';
import {
  ThroughputModel,
  InboundMetrics,
  OutboundMetrics,
  PeakMetrics,
} from '../types';

/**
 * Load throughput model from historical data
 * Default period: last 30 days
 */
export async function loadThroughputModel(periodDays: number = 30): Promise<ThroughputModel> {
  const supabase = await createClient();
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get inbound data from inventory ledger
  const { data: inboundData, error: inboundError } = await supabase
    .from('wms_inventory_ledger')
    .select('created_at, piece_qty, pallet_id, reference_type')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr)
    .gt('piece_qty', 0)
    .in('reference_type', ['receive', 'putaway', 'adjustment_in']);

  if (inboundError) {
    console.error('[ThroughputModel] Error loading inbound data:', inboundError);
    throw new Error(`Failed to load inbound data: ${inboundError.message}`);
  }

  // Get outbound data from inventory ledger
  const { data: outboundData, error: outboundError } = await supabase
    .from('wms_inventory_ledger')
    .select('created_at, piece_qty, reference_type')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr)
    .lt('piece_qty', 0)
    .in('reference_type', ['ship', 'pick', 'adjustment_out']);

  if (outboundError) {
    console.error('[ThroughputModel] Error loading outbound data:', outboundError);
    throw new Error(`Failed to load outbound data: ${outboundError.message}`);
  }

  // Get receiving orders count
  const { data: receivingOrders, error: recError } = await supabase
    .from('receiving_orders')
    .select('id, created_at')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  if (recError) {
    console.error('[ThroughputModel] Error loading receiving orders:', recError);
  }

  // Get shipping orders count
  const { data: shippingOrders, error: shipError } = await supabase
    .from('wms_orders')
    .select('id, created_at')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  if (shipError) {
    console.error('[ThroughputModel] Error loading shipping orders:', shipError);
  }

  // Aggregate inbound by day
  const inboundByDay = aggregateByDay(inboundData || [], 'piece_qty');
  const inboundPalletsByDay = aggregatePalletsByDay(inboundData || []);
  
  // Aggregate outbound by day (convert negative to positive)
  const outboundByDay = aggregateByDay(
    (outboundData || []).map(d => ({ ...d, piece_qty: Math.abs(d.piece_qty) })),
    'piece_qty'
  );

  // Calculate inbound metrics
  const inboundDays = Object.keys(inboundByDay);
  const totalInboundQty = Object.values(inboundByDay).reduce((sum, qty) => sum + qty, 0);
  const avgDailyInbound = inboundDays.length > 0 ? totalInboundQty / inboundDays.length : 0;
  const peakInboundDay = findPeakDay(inboundByDay);
  const totalInboundPallets = Object.values(inboundPalletsByDay).reduce((sum, qty) => sum + qty, 0);
  const avgDailyPallets = inboundDays.length > 0 ? totalInboundPallets / inboundDays.length : 0;

  const inbound: InboundMetrics = {
    avg_daily_qty: Math.round(avgDailyInbound),
    avg_daily_orders: receivingOrders ? Math.round(receivingOrders.length / Math.max(1, periodDays)) : 0,
    avg_daily_pallets: Math.round(avgDailyPallets),
    peak_daily_qty: peakInboundDay.qty,
    peak_daily_orders: 0, // Would need more detailed data
    peak_date: peakInboundDay.date,
    total_qty: totalInboundQty,
    total_orders: receivingOrders?.length || 0,
    data_points: inboundData?.length || 0,
  };

  // Calculate outbound metrics
  const outboundDays = Object.keys(outboundByDay);
  const totalOutboundQty = Object.values(outboundByDay).reduce((sum, qty) => sum + qty, 0);
  const avgDailyOutbound = outboundDays.length > 0 ? totalOutboundQty / outboundDays.length : 0;
  const peakOutboundDay = findPeakDay(outboundByDay);

  const outbound: OutboundMetrics = {
    avg_daily_qty: Math.round(avgDailyOutbound),
    avg_daily_orders: shippingOrders ? Math.round(shippingOrders.length / Math.max(1, periodDays)) : 0,
    avg_daily_picks: Math.round(avgDailyOutbound), // Simplified: 1 pick = 1 qty
    peak_daily_qty: peakOutboundDay.qty,
    peak_daily_orders: 0,
    peak_date: peakOutboundDay.date,
    total_qty: totalOutboundQty,
    total_orders: shippingOrders?.length || 0,
    data_points: outboundData?.length || 0,
  };

  // Historical peak
  const historicalPeak: PeakMetrics = {
    inbound_peak_qty: peakInboundDay.qty,
    inbound_peak_date: peakInboundDay.date,
    outbound_peak_qty: peakOutboundDay.qty,
    outbound_peak_date: peakOutboundDay.date,
  };

  return {
    inbound,
    outbound,
    historical_peak: historicalPeak,
    period_days: periodDays,
    data_from: startDateStr,
    data_to: endDateStr,
  };
}

/**
 * Apply demand multiplier to throughput model
 * Property 5: Demand Multiplier Application
 * simulated daily_orders = baseline daily_orders * M
 */
export function applyDemandMultiplier(model: ThroughputModel, multiplier: number): ThroughputModel {
  // Deep clone to ensure isolation
  const newModel: ThroughputModel = JSON.parse(JSON.stringify(model));

  // Apply multiplier to outbound (demand)
  newModel.outbound = {
    ...newModel.outbound,
    avg_daily_qty: Math.round(newModel.outbound.avg_daily_qty * multiplier),
    avg_daily_orders: Math.round(newModel.outbound.avg_daily_orders * multiplier),
    avg_daily_picks: Math.round(newModel.outbound.avg_daily_picks * multiplier),
  };

  return newModel;
}

/**
 * Identify bottlenecks by comparing demand against historical peak
 */
export function identifyThroughputBottlenecks(
  baseline: ThroughputModel,
  simulated: ThroughputModel
): { type: 'inbound' | 'outbound'; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }[] {
  const bottlenecks: { type: 'inbound' | 'outbound'; severity: 'low' | 'medium' | 'high' | 'critical'; message: string }[] = [];

  // Check outbound against historical peak
  const outboundRatio = simulated.outbound.avg_daily_qty / baseline.historical_peak.outbound_peak_qty;
  
  if (outboundRatio > 1.2) {
    bottlenecks.push({
      type: 'outbound',
      severity: outboundRatio > 1.5 ? 'critical' : outboundRatio > 1.3 ? 'high' : 'medium',
      message: `Simulated outbound (${simulated.outbound.avg_daily_qty.toLocaleString()}) exceeds historical peak (${baseline.historical_peak.outbound_peak_qty.toLocaleString()}) by ${Math.round((outboundRatio - 1) * 100)}%`,
    });
  }

  // Check inbound against historical peak
  const inboundRatio = simulated.inbound.avg_daily_qty / baseline.historical_peak.inbound_peak_qty;
  
  if (inboundRatio > 1.2) {
    bottlenecks.push({
      type: 'inbound',
      severity: inboundRatio > 1.5 ? 'critical' : inboundRatio > 1.3 ? 'high' : 'medium',
      message: `Simulated inbound (${simulated.inbound.avg_daily_qty.toLocaleString()}) exceeds historical peak (${baseline.historical_peak.inbound_peak_qty.toLocaleString()}) by ${Math.round((inboundRatio - 1) * 100)}%`,
    });
  }

  return bottlenecks;
}

// ============================================
// Helper Functions
// ============================================

function aggregateByDay(data: any[], qtyField: string): Record<string, number> {
  const byDay: Record<string, number> = {};
  
  data.forEach((item) => {
    const date = new Date(item.created_at).toISOString().split('T')[0];
    byDay[date] = (byDay[date] || 0) + (item[qtyField] || 0);
  });
  
  return byDay;
}

function aggregatePalletsByDay(data: any[]): Record<string, number> {
  const byDay: Record<string, Set<string>> = {};
  
  data.forEach((item) => {
    if (!item.pallet_id) return;
    const date = new Date(item.created_at).toISOString().split('T')[0];
    if (!byDay[date]) byDay[date] = new Set();
    byDay[date].add(item.pallet_id);
  });
  
  const result: Record<string, number> = {};
  Object.entries(byDay).forEach(([date, pallets]) => {
    result[date] = pallets.size;
  });
  
  return result;
}

function findPeakDay(byDay: Record<string, number>): { date: string; qty: number } {
  let peakDate = '';
  let peakQty = 0;
  
  Object.entries(byDay).forEach(([date, qty]) => {
    if (qty > peakQty) {
      peakQty = qty;
      peakDate = date;
    }
  });
  
  return { date: peakDate || 'N/A', qty: peakQty };
}

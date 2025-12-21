/**
 * Lead Time Model for Digital Twin
 * 
 * Calculates supplier lead times from historical receiving data
 * 
 * Properties validated:
 * - Property 6: Lead Time Addition
 */

import { createClient } from '@/lib/supabase/server';
import {
  LeadTimeModel,
  SupplierLeadTime,
} from '../types';

/**
 * Load lead time model from historical receiving orders
 */
export async function loadLeadTimeModel(periodDays: number = 90): Promise<LeadTimeModel> {
  const supabase = await createClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get receiving orders with supplier info and dates
  const { data: orders, error } = await supabase
    .from('receiving_orders')
    .select(`
      id,
      supplier_id,
      order_date,
      received_date,
      status,
      master_supplier!inner (
        id,
        name
      )
    `)
    .gte('order_date', startDateStr)
    .eq('status', 'completed')
    .not('received_date', 'is', null);

  if (error) {
    console.error('[LeadTimeModel] Error loading receiving orders:', error);
    throw new Error(`Failed to load receiving orders: ${error.message}`);
  }

  // Group by supplier and calculate lead times
  const supplierData: Record<string, { name: string; leadTimes: number[] }> = {};

  orders?.forEach((order) => {
    if (!order.order_date || !order.received_date) return;

    const orderDate = new Date(order.order_date);
    const receivedDate = new Date(order.received_date);
    const leadTimeDays = Math.round((receivedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Skip invalid lead times
    if (leadTimeDays < 0 || leadTimeDays > 365) return;

    const supplierId = order.supplier_id;
    if (!supplierData[supplierId]) {
      supplierData[supplierId] = {
        name: (order.master_supplier as any)?.name || 'Unknown',
        leadTimes: [],
      };
    }
    supplierData[supplierId].leadTimes.push(leadTimeDays);
  });

  // Calculate statistics for each supplier
  const suppliers: SupplierLeadTime[] = Object.entries(supplierData).map(([supplierId, data]) => {
    const leadTimes = data.leadTimes.sort((a, b) => a - b);
    const stats = calculateLeadTimeStats(leadTimes);

    return {
      supplier_id: supplierId,
      supplier_name: data.name,
      avg_lead_time: stats.avg,
      p50_lead_time: stats.p50,
      p90_lead_time: stats.p90,
      min_lead_time: stats.min,
      max_lead_time: stats.max,
      std_deviation: stats.std,
      variability_score: getVariabilityScore(stats.std),
      data_points: leadTimes.length,
    };
  });

  // Calculate overall statistics
  const allLeadTimes = Object.values(supplierData).flatMap((d) => d.leadTimes).sort((a, b) => a - b);
  const overallStats = calculateLeadTimeStats(allLeadTimes);

  // Identify high variability suppliers (std > 3 days)
  const highVariabilitySuppliers = suppliers
    .filter((s) => s.variability_score === 'high')
    .map((s) => s.supplier_id);

  return {
    suppliers,
    overall: {
      avg_lead_time: overallStats.avg,
      p50_lead_time: overallStats.p50,
      p90_lead_time: overallStats.p90,
      std_deviation: overallStats.std,
    },
    high_variability_suppliers: highVariabilitySuppliers,
  };
}

/**
 * Apply lead time increase to model
 * Property 6: Lead Time Addition
 * simulated lead_time = baseline lead_time + D
 */
export function applyLeadTimeIncrease(
  model: LeadTimeModel,
  increaseDays: number,
  supplierIds?: string[]
): LeadTimeModel {
  // Deep clone to ensure isolation
  const newModel: LeadTimeModel = JSON.parse(JSON.stringify(model));

  // Apply increase to specified suppliers or all
  newModel.suppliers = newModel.suppliers.map((supplier) => {
    if (supplierIds && supplierIds.length > 0 && !supplierIds.includes(supplier.supplier_id)) {
      return supplier;
    }

    // Property 6: Add lead_time_increase_days to all lead time metrics
    return {
      ...supplier,
      avg_lead_time: supplier.avg_lead_time + increaseDays,
      p50_lead_time: supplier.p50_lead_time + increaseDays,
      p90_lead_time: supplier.p90_lead_time + increaseDays,
      min_lead_time: supplier.min_lead_time + increaseDays,
      max_lead_time: supplier.max_lead_time + increaseDays,
      // std_deviation remains the same (variability doesn't change)
    };
  });

  // Recalculate overall
  const avgLeadTimes = newModel.suppliers.map((s) => s.avg_lead_time);
  const p50LeadTimes = newModel.suppliers.map((s) => s.p50_lead_time);
  const p90LeadTimes = newModel.suppliers.map((s) => s.p90_lead_time);

  newModel.overall = {
    avg_lead_time: avgLeadTimes.length > 0 
      ? Math.round(avgLeadTimes.reduce((a, b) => a + b, 0) / avgLeadTimes.length) 
      : 0,
    p50_lead_time: p50LeadTimes.length > 0 
      ? Math.round(p50LeadTimes.reduce((a, b) => a + b, 0) / p50LeadTimes.length) 
      : 0,
    p90_lead_time: p90LeadTimes.length > 0 
      ? Math.round(p90LeadTimes.reduce((a, b) => a + b, 0) / p90LeadTimes.length) 
      : 0,
    std_deviation: model.overall.std_deviation, // Unchanged
  };

  return newModel;
}

/**
 * Calculate safety stock based on lead time and consumption
 */
export function calculateSafetyStock(
  leadTimeDays: number,
  avgDailyConsumption: number,
  serviceLevel: number = 0.95 // 95% service level
): number {
  // Safety stock = Z * σ_LT * √L
  // Where Z is the service level factor, σ_LT is demand variability, L is lead time
  // Simplified: Safety stock = lead_time * avg_daily_consumption * safety_factor
  
  const safetyFactor = serviceLevel >= 0.99 ? 2.33 
    : serviceLevel >= 0.95 ? 1.65 
    : serviceLevel >= 0.90 ? 1.28 
    : 1.0;

  // Simplified calculation: safety_stock = avg_daily * lead_time * factor
  return Math.ceil(avgDailyConsumption * leadTimeDays * safetyFactor * 0.5);
}

/**
 * Calculate reorder point
 */
export function calculateReorderPoint(
  leadTimeDays: number,
  avgDailyConsumption: number,
  safetyStock: number
): number {
  // Reorder point = (Lead time * Daily demand) + Safety stock
  return Math.ceil(leadTimeDays * avgDailyConsumption + safetyStock);
}

/**
 * Identify SKUs at risk of stockout due to lead time increase
 */
export function identifyStockoutRisk(
  currentStock: number,
  avgDailyConsumption: number,
  newLeadTimeDays: number
): {
  at_risk: boolean;
  days_of_cover: number | null;
  stockout_before_arrival: boolean;
  shortage_qty: number;
} {
  if (avgDailyConsumption <= 0) {
    return {
      at_risk: false,
      days_of_cover: null,
      stockout_before_arrival: false,
      shortage_qty: 0,
    };
  }

  const daysOfCover = Math.floor(currentStock / avgDailyConsumption);
  const stockoutBeforeArrival = daysOfCover < newLeadTimeDays;
  const shortageQty = stockoutBeforeArrival 
    ? Math.ceil((newLeadTimeDays - daysOfCover) * avgDailyConsumption)
    : 0;

  return {
    at_risk: stockoutBeforeArrival,
    days_of_cover: daysOfCover,
    stockout_before_arrival: stockoutBeforeArrival,
    shortage_qty: shortageQty,
  };
}

// ============================================
// Helper Functions
// ============================================

function calculateLeadTimeStats(leadTimes: number[]): {
  avg: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
  std: number;
} {
  if (leadTimes.length === 0) {
    return { avg: 0, p50: 0, p90: 0, min: 0, max: 0, std: 0 };
  }

  const sorted = [...leadTimes].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  // Percentiles
  const p50Index = Math.floor(sorted.length * 0.5);
  const p90Index = Math.floor(sorted.length * 0.9);

  // Standard deviation
  const squaredDiffs = sorted.map((lt) => Math.pow(lt - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
  const std = Math.sqrt(avgSquaredDiff);

  return {
    avg: Math.round(avg * 10) / 10,
    p50: sorted[p50Index] || 0,
    p90: sorted[p90Index] || sorted[sorted.length - 1] || 0,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    std: Math.round(std * 10) / 10,
  };
}

function getVariabilityScore(stdDeviation: number): 'low' | 'medium' | 'high' {
  if (stdDeviation <= 2) return 'low';
  if (stdDeviation <= 5) return 'medium';
  return 'high';
}

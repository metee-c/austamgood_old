/**
 * Intelligence Engine Types
 * Common types for all intelligence calculations
 */

// ============================================
// Base Types
// ============================================

export interface IntelligenceMetric {
  metric_name: string;
  metric_value: number | string | null;
  unit: string;
  calculation_method: string;
  data_window: string;
  data_points: number;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_percent: number;
  last_updated: string;
}

export interface IntelligenceResponse<T = any> {
  success: boolean;
  data: T;
  metadata: {
    calculation_method: string;
    data_window: string;
    data_points: number;
    confidence_level: 'high' | 'medium' | 'low';
    confidence_percent: number;
    generated_at: string;
  };
  disclaimer?: string;
  error?: string;
}

// ============================================
// Consumption Intelligence
// ============================================

export interface SKUConsumptionProfile {
  sku_id: string;
  sku_name: string;
  avg_daily_consumption: number;
  min_daily_consumption: number;
  max_daily_consumption: number;
  std_deviation: number;
  coefficient_of_variation: number; // std/avg - volatility indicator
  trend_7d: number; // % change vs previous 7d
  trend_30d: number; // % change vs previous 30d
  seasonality_factor: number; // 1.0 = normal
  data_points: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConsumptionTrend {
  sku_id: string;
  period: '7d' | '30d' | '90d';
  current_avg: number;
  previous_avg: number;
  change_percent: number;
  trend_direction: 'increasing' | 'stable' | 'decreasing';
}

// ============================================
// Days of Cover Intelligence
// ============================================

export interface DaysOfCoverResult {
  sku_id: string;
  sku_name: string;
  current_stock: number;
  reserved_qty: number;
  available_qty: number;
  avg_daily_consumption: number;
  days_of_cover: number | null;
  risk_level: 'critical' | 'warning' | 'normal' | 'excess';
  reorder_point: number | null;
  safety_stock: number | null;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// Risk Intelligence
// ============================================

export interface ShortageRisk {
  sku_id: string;
  sku_name: string;
  current_stock: number;
  avg_daily_consumption: number;
  days_of_cover: number | null;
  pending_orders_qty: number;
  risk_score: number; // 0-100
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  estimated_stockout_date: string | null;
  recommended_action: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface OverstockRisk {
  sku_id: string;
  sku_name: string;
  current_stock: number;
  avg_daily_consumption: number;
  days_of_cover: number | null;
  excess_qty: number;
  risk_score: number; // 0-100
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  holding_cost_impact: string;
  recommended_action: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ExpiryRisk {
  sku_id: string;
  sku_name: string;
  location_id: string;
  lot_no: string | null;
  expiry_date: string;
  days_until_expiry: number;
  quantity: number;
  risk_level: 'expired' | 'critical' | 'warning' | 'normal';
  estimated_consumption_before_expiry: number;
  will_expire_before_consumed: boolean;
  recommended_action: string;
}

// ============================================
// Utilization Intelligence
// ============================================

export interface LocationUtilization {
  location_id: string;
  location_code: string;
  zone: string;
  max_capacity: number;
  current_qty: number;
  utilization_percent: number;
  status: 'empty' | 'low' | 'optimal' | 'high' | 'full';
  avg_utilization_7d: number;
  avg_utilization_30d: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface WarehouseUtilization {
  warehouse_id: string;
  warehouse_name: string;
  total_locations: number;
  occupied_locations: number;
  empty_locations: number;
  total_capacity: number;
  current_stock: number;
  utilization_percent: number;
  by_zone: Record<string, {
    locations: number;
    utilization: number;
  }>;
}

// ============================================
// Throughput Intelligence
// ============================================

export interface DailyThroughput {
  date: string;
  inbound_qty: number;
  outbound_qty: number;
  net_flow: number;
  orders_received: number;
  orders_shipped: number;
}

export interface ThroughputSummary {
  period: string;
  avg_daily_inbound: number;
  avg_daily_outbound: number;
  peak_inbound_day: string;
  peak_outbound_day: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ============================================
// Confidence Calculation
// ============================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: { min_data_points: 30, min_percent: 80 },
  MEDIUM: { min_data_points: 14, min_percent: 60 },
  LOW: { min_data_points: 0, min_percent: 0 },
};

export function calculateConfidence(
  dataPoints: number,
  dataQuality: number = 1.0 // 0-1 scale
): { level: 'high' | 'medium' | 'low'; percent: number } {
  const baseConfidence = Math.min(100, (dataPoints / 30) * 100);
  const adjustedConfidence = Math.round(baseConfidence * dataQuality);

  if (dataPoints >= CONFIDENCE_THRESHOLDS.HIGH.min_data_points) {
    return { level: 'high', percent: Math.min(95, adjustedConfidence) };
  } else if (dataPoints >= CONFIDENCE_THRESHOLDS.MEDIUM.min_data_points) {
    return { level: 'medium', percent: Math.min(79, adjustedConfidence) };
  }
  return { level: 'low', percent: Math.min(59, adjustedConfidence) };
}

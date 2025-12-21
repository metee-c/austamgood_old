/**
 * Utilization Intelligence Engine
 * Calculates warehouse and location utilization metrics
 * 
 * RULES:
 * - NO AI, NO GUESSING
 * - ONLY math + aggregation from actual data
 * - All calculations are deterministic
 */

import {
  LocationUtilization,
  WarehouseUtilization,
  calculateConfidence,
} from './types';

// ============================================
// Utilization Thresholds
// ============================================

export const UTILIZATION_THRESHOLDS = {
  empty: 0,
  low: 30,
  optimal_min: 50,
  optimal_max: 80,
  high: 90,
  full: 100,
};

// ============================================
// Location Utilization Calculation
// ============================================

export function calculateLocationUtilization(params: {
  location_id: string;
  location_code: string;
  zone: string;
  max_capacity: number;
  current_qty: number;
  historical_qty_7d?: number[];
  historical_qty_30d?: number[];
}): LocationUtilization {
  const {
    location_id,
    location_code,
    zone,
    max_capacity,
    current_qty,
    historical_qty_7d = [],
    historical_qty_30d = [],
  } = params;

  // Calculate current utilization
  const utilization_percent =
    max_capacity > 0
      ? Math.round((current_qty / max_capacity) * 100)
      : current_qty > 0
        ? 100
        : 0;

  // Determine status
  let status: LocationUtilization['status'] = 'optimal';
  if (utilization_percent === 0) {
    status = 'empty';
  } else if (utilization_percent < UTILIZATION_THRESHOLDS.low) {
    status = 'low';
  } else if (utilization_percent >= UTILIZATION_THRESHOLDS.full) {
    status = 'full';
  } else if (utilization_percent >= UTILIZATION_THRESHOLDS.high) {
    status = 'high';
  }

  // Calculate historical averages
  const avg_utilization_7d =
    historical_qty_7d.length > 0
      ? Math.round(
          (historical_qty_7d.reduce((a, b) => a + b, 0) /
            historical_qty_7d.length /
            max_capacity) *
            100
        )
      : utilization_percent;

  const avg_utilization_30d =
    historical_qty_30d.length > 0
      ? Math.round(
          (historical_qty_30d.reduce((a, b) => a + b, 0) /
            historical_qty_30d.length /
            max_capacity) *
            100
        )
      : utilization_percent;

  // Determine trend
  let trend: LocationUtilization['trend'] = 'stable';
  const trendThreshold = 5; // 5% change threshold
  if (avg_utilization_7d > avg_utilization_30d + trendThreshold) {
    trend = 'increasing';
  } else if (avg_utilization_7d < avg_utilization_30d - trendThreshold) {
    trend = 'decreasing';
  }

  return {
    location_id,
    location_code,
    zone,
    max_capacity,
    current_qty,
    utilization_percent,
    status,
    avg_utilization_7d,
    avg_utilization_30d,
    trend,
  };
}

// ============================================
// Warehouse Utilization Calculation
// ============================================

export function calculateWarehouseUtilization(params: {
  warehouse_id: string;
  warehouse_name: string;
  locations: Array<{
    location_id: string;
    zone: string;
    max_capacity: number;
    current_qty: number;
  }>;
}): WarehouseUtilization {
  const { warehouse_id, warehouse_name, locations } = params;

  const total_locations = locations.length;
  const occupied_locations = locations.filter((l) => l.current_qty > 0).length;
  const empty_locations = total_locations - occupied_locations;

  const total_capacity = locations.reduce((sum, l) => sum + l.max_capacity, 0);
  const current_stock = locations.reduce((sum, l) => sum + l.current_qty, 0);

  const utilization_percent =
    total_capacity > 0
      ? Math.round((current_stock / total_capacity) * 100)
      : 0;

  // Calculate by zone
  const zoneMap = new Map<
    string,
    { locations: number; capacity: number; stock: number }
  >();

  locations.forEach((loc) => {
    const zone = loc.zone || 'Unknown';
    const existing = zoneMap.get(zone) || {
      locations: 0,
      capacity: 0,
      stock: 0,
    };
    zoneMap.set(zone, {
      locations: existing.locations + 1,
      capacity: existing.capacity + loc.max_capacity,
      stock: existing.stock + loc.current_qty,
    });
  });

  const by_zone: Record<string, { locations: number; utilization: number }> =
    {};
  zoneMap.forEach((data, zone) => {
    by_zone[zone] = {
      locations: data.locations,
      utilization:
        data.capacity > 0
          ? Math.round((data.stock / data.capacity) * 100)
          : 0,
    };
  });

  return {
    warehouse_id,
    warehouse_name,
    total_locations,
    occupied_locations,
    empty_locations,
    total_capacity,
    current_stock,
    utilization_percent,
    by_zone,
  };
}

// ============================================
// Utilization Recommendations
// ============================================

export interface UtilizationRecommendation {
  type: 'consolidation' | 'expansion' | 'rebalance' | 'none';
  priority: 'high' | 'medium' | 'low';
  description: string;
  affected_locations: string[];
  potential_savings: string;
}

export function generateUtilizationRecommendations(
  locations: LocationUtilization[]
): UtilizationRecommendation[] {
  const recommendations: UtilizationRecommendation[] = [];

  // Find empty locations
  const emptyLocations = locations.filter((l) => l.status === 'empty');
  const lowLocations = locations.filter((l) => l.status === 'low');
  const fullLocations = locations.filter((l) => l.status === 'full');
  const highLocations = locations.filter((l) => l.status === 'high');

  // Consolidation opportunity
  if (lowLocations.length >= 2) {
    const totalLowQty = lowLocations.reduce((sum, l) => sum + l.current_qty, 0);
    const avgCapacity =
      lowLocations.reduce((sum, l) => sum + l.max_capacity, 0) /
      lowLocations.length;
    const potentialConsolidation = Math.floor(totalLowQty / avgCapacity);

    if (potentialConsolidation < lowLocations.length) {
      recommendations.push({
        type: 'consolidation',
        priority: 'medium',
        description: `พบ ${lowLocations.length} โลเคชั่นที่ใช้งานต่ำ สามารถรวมเป็น ${potentialConsolidation} โลเคชั่นได้`,
        affected_locations: lowLocations.map((l) => l.location_code),
        potential_savings: `ประหยัดพื้นที่ ${lowLocations.length - potentialConsolidation} โลเคชั่น`,
      });
    }
  }

  // Expansion warning
  if (fullLocations.length > locations.length * 0.2) {
    recommendations.push({
      type: 'expansion',
      priority: 'high',
      description: `${fullLocations.length} โลเคชั่น (${Math.round((fullLocations.length / locations.length) * 100)}%) เต็มแล้ว`,
      affected_locations: fullLocations.map((l) => l.location_code),
      potential_savings: 'ควรพิจารณาขยายพื้นที่หรือปรับปรุงการจัดวาง',
    });
  }

  // Rebalance opportunity
  if (emptyLocations.length > 0 && highLocations.length > 0) {
    recommendations.push({
      type: 'rebalance',
      priority: 'low',
      description: `มี ${emptyLocations.length} โลเคชั่นว่าง และ ${highLocations.length} โลเคชั่นใกล้เต็ม`,
      affected_locations: [
        ...emptyLocations.slice(0, 3).map((l) => l.location_code),
        ...highLocations.slice(0, 3).map((l) => l.location_code),
      ],
      potential_savings: 'สามารถกระจายสต็อกเพื่อเพิ่มประสิทธิภาพการหยิบ',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'none',
      priority: 'low',
      description: 'การใช้พื้นที่อยู่ในระดับเหมาะสม',
      affected_locations: [],
      potential_savings: 'ไม่มีการปรับปรุงที่แนะนำ',
    });
  }

  return recommendations;
}

// ============================================
// Utilization Summary
// ============================================

export interface UtilizationSummary {
  total_locations: number;
  empty_count: number;
  low_count: number;
  optimal_count: number;
  high_count: number;
  full_count: number;
  overall_utilization: number;
  health_score: number;
  recommendations: UtilizationRecommendation[];
}

export function calculateUtilizationSummary(
  locations: LocationUtilization[]
): UtilizationSummary {
  const empty_count = locations.filter((l) => l.status === 'empty').length;
  const low_count = locations.filter((l) => l.status === 'low').length;
  const optimal_count = locations.filter((l) => l.status === 'optimal').length;
  const high_count = locations.filter((l) => l.status === 'high').length;
  const full_count = locations.filter((l) => l.status === 'full').length;

  const total_capacity = locations.reduce((sum, l) => sum + l.max_capacity, 0);
  const total_stock = locations.reduce((sum, l) => sum + l.current_qty, 0);
  const overall_utilization =
    total_capacity > 0
      ? Math.round((total_stock / total_capacity) * 100)
      : 0;

  // Health score: optimal utilization is best
  let health_score = 100;
  const optimalRatio = optimal_count / locations.length;
  const fullRatio = full_count / locations.length;
  const emptyRatio = empty_count / locations.length;

  health_score = Math.round(
    optimalRatio * 100 - fullRatio * 30 - emptyRatio * 20
  );
  health_score = Math.max(0, Math.min(100, health_score));

  const recommendations = generateUtilizationRecommendations(locations);

  return {
    total_locations: locations.length,
    empty_count,
    low_count,
    optimal_count,
    high_count,
    full_count,
    overall_utilization,
    health_score,
    recommendations,
  };
}

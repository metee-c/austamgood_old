/**
 * Risk Intelligence Engine
 * Calculates shortage, overstock, and expiry risks
 * 
 * RULES:
 * - NO AI, NO GUESSING
 * - ONLY math + aggregation from historical data
 * - All calculations are deterministic
 */

import {
  ShortageRisk,
  OverstockRisk,
  ExpiryRisk,
  calculateConfidence,
} from './types';

// ============================================
// Risk Thresholds
// ============================================

export const RISK_THRESHOLDS = {
  shortage: {
    critical: 3, // days of cover
    high: 7,
    medium: 14,
    low: 30,
  },
  overstock: {
    critical: 180, // days of cover
    high: 120,
    medium: 90,
    low: 60,
  },
  expiry: {
    critical: 7, // days until expiry
    warning: 30,
    normal: 90,
  },
};

// ============================================
// Shortage Risk Calculation
// ============================================

export function calculateShortageRisk(params: {
  sku_id: string;
  sku_name: string;
  current_stock: number;
  reserved_qty: number;
  avg_daily_consumption: number;
  pending_orders_qty: number;
  reorder_point?: number;
  data_points: number;
}): ShortageRisk {
  const {
    sku_id,
    sku_name,
    current_stock,
    reserved_qty,
    avg_daily_consumption,
    pending_orders_qty,
    reorder_point,
    data_points,
  } = params;

  const available_qty = current_stock - reserved_qty;
  const effective_stock = available_qty - pending_orders_qty;

  // Calculate days of cover
  let days_of_cover: number | null = null;
  if (avg_daily_consumption > 0) {
    days_of_cover = Math.round(effective_stock / avg_daily_consumption);
  }

  // Calculate risk score (0-100)
  let risk_score = 0;
  let risk_level: ShortageRisk['risk_level'] = 'low';
  let estimated_stockout_date: string | null = null;

  if (days_of_cover !== null) {
    if (days_of_cover <= RISK_THRESHOLDS.shortage.critical) {
      risk_score = 90 + (RISK_THRESHOLDS.shortage.critical - days_of_cover) * 3;
      risk_level = 'critical';
    } else if (days_of_cover <= RISK_THRESHOLDS.shortage.high) {
      risk_score = 70 + ((RISK_THRESHOLDS.shortage.high - days_of_cover) / 4) * 20;
      risk_level = 'high';
    } else if (days_of_cover <= RISK_THRESHOLDS.shortage.medium) {
      risk_score = 40 + ((RISK_THRESHOLDS.shortage.medium - days_of_cover) / 7) * 30;
      risk_level = 'medium';
    } else {
      risk_score = Math.max(0, 40 - (days_of_cover - RISK_THRESHOLDS.shortage.medium));
      risk_level = 'low';
    }

    // Estimate stockout date
    if (days_of_cover > 0 && days_of_cover < 365) {
      const stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + days_of_cover);
      estimated_stockout_date = stockoutDate.toISOString().split('T')[0];
    }
  } else if (current_stock <= 0) {
    risk_score = 100;
    risk_level = 'critical';
  }

  // Adjust for reorder point
  if (reorder_point && current_stock < reorder_point) {
    risk_score = Math.min(100, risk_score + 10);
  }

  risk_score = Math.min(100, Math.max(0, Math.round(risk_score)));

  // Generate recommendation
  let recommended_action = '';
  switch (risk_level) {
    case 'critical':
      recommended_action = 'เร่งสั่งซื้อทันที หรือพิจารณาสินค้าทดแทน';
      break;
    case 'high':
      recommended_action = 'วางแผนสั่งซื้อภายใน 1-2 วัน';
      break;
    case 'medium':
      recommended_action = 'ติดตามสถานการณ์และเตรียมสั่งซื้อ';
      break;
    default:
      recommended_action = 'สต็อกเพียงพอ ไม่ต้องดำเนินการ';
  }

  const confidence = calculateConfidence(data_points);

  return {
    sku_id,
    sku_name,
    current_stock,
    avg_daily_consumption,
    days_of_cover,
    pending_orders_qty,
    risk_score,
    risk_level,
    estimated_stockout_date,
    recommended_action,
    confidence: confidence.level,
  };
}

// ============================================
// Overstock Risk Calculation
// ============================================

export function calculateOverstockRisk(params: {
  sku_id: string;
  sku_name: string;
  current_stock: number;
  avg_daily_consumption: number;
  max_stock_level?: number;
  shelf_life_days?: number;
  data_points: number;
}): OverstockRisk {
  const {
    sku_id,
    sku_name,
    current_stock,
    avg_daily_consumption,
    max_stock_level,
    shelf_life_days,
    data_points,
  } = params;

  // Calculate days of cover
  let days_of_cover: number | null = null;
  if (avg_daily_consumption > 0) {
    days_of_cover = Math.round(current_stock / avg_daily_consumption);
  }

  // Calculate excess quantity
  let excess_qty = 0;
  const optimal_stock = avg_daily_consumption * RISK_THRESHOLDS.overstock.low;
  if (current_stock > optimal_stock) {
    excess_qty = Math.round(current_stock - optimal_stock);
  }

  // Calculate risk score (0-100)
  let risk_score = 0;
  let risk_level: OverstockRisk['risk_level'] = 'low';

  if (days_of_cover !== null) {
    if (days_of_cover >= RISK_THRESHOLDS.overstock.critical) {
      risk_score = 90;
      risk_level = 'critical';
    } else if (days_of_cover >= RISK_THRESHOLDS.overstock.high) {
      risk_score = 70;
      risk_level = 'high';
    } else if (days_of_cover >= RISK_THRESHOLDS.overstock.medium) {
      risk_score = 50;
      risk_level = 'medium';
    } else if (days_of_cover >= RISK_THRESHOLDS.overstock.low) {
      risk_score = 30;
      risk_level = 'low';
    }

    // Adjust for shelf life
    if (shelf_life_days && days_of_cover > shelf_life_days) {
      risk_score = Math.min(100, risk_score + 20);
      if (risk_level !== 'critical') {
        risk_level = 'high';
      }
    }
  } else if (current_stock > 0 && avg_daily_consumption === 0) {
    // No consumption = dead stock
    risk_score = 95;
    risk_level = 'critical';
  }

  risk_score = Math.min(100, Math.max(0, Math.round(risk_score)));

  // Holding cost impact
  let holding_cost_impact = 'ต่ำ';
  if (risk_level === 'critical') {
    holding_cost_impact = 'สูงมาก - ควรพิจารณาลดราคาหรือโอนย้าย';
  } else if (risk_level === 'high') {
    holding_cost_impact = 'สูง - ต้นทุนการจัดเก็บสูงกว่าปกติ';
  } else if (risk_level === 'medium') {
    holding_cost_impact = 'ปานกลาง - ควรติดตาม';
  }

  // Generate recommendation
  let recommended_action = '';
  switch (risk_level) {
    case 'critical':
      recommended_action = 'พิจารณาโปรโมชั่น ลดราคา หรือโอนย้ายไปสาขาอื่น';
      break;
    case 'high':
      recommended_action = 'ชะลอการสั่งซื้อ และเร่งระบายสต็อก';
      break;
    case 'medium':
      recommended_action = 'ปรับแผนการสั่งซื้อให้สอดคล้องกับการใช้งาน';
      break;
    default:
      recommended_action = 'สต็อกอยู่ในระดับเหมาะสม';
  }

  const confidence = calculateConfidence(data_points);

  return {
    sku_id,
    sku_name,
    current_stock,
    avg_daily_consumption,
    days_of_cover,
    excess_qty,
    risk_score,
    risk_level,
    holding_cost_impact,
    recommended_action,
    confidence: confidence.level,
  };
}

// ============================================
// Expiry Risk Calculation
// ============================================

export function calculateExpiryRisk(params: {
  sku_id: string;
  sku_name: string;
  location_id: string;
  lot_no: string | null;
  expiry_date: string;
  quantity: number;
  avg_daily_consumption: number;
}): ExpiryRisk {
  const {
    sku_id,
    sku_name,
    location_id,
    lot_no,
    expiry_date,
    quantity,
    avg_daily_consumption,
  } = params;

  // Calculate days until expiry
  const today = new Date();
  const expiry = new Date(expiry_date);
  const days_until_expiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine risk level
  let risk_level: ExpiryRisk['risk_level'] = 'normal';
  if (days_until_expiry <= 0) {
    risk_level = 'expired';
  } else if (days_until_expiry <= RISK_THRESHOLDS.expiry.critical) {
    risk_level = 'critical';
  } else if (days_until_expiry <= RISK_THRESHOLDS.expiry.warning) {
    risk_level = 'warning';
  }

  // Estimate consumption before expiry
  const estimated_consumption_before_expiry =
    avg_daily_consumption > 0
      ? Math.round(avg_daily_consumption * Math.max(0, days_until_expiry))
      : 0;

  const will_expire_before_consumed =
    quantity > estimated_consumption_before_expiry;

  // Generate recommendation
  let recommended_action = '';
  if (risk_level === 'expired') {
    recommended_action = 'ดำเนินการปรับสต็อกและทำลายสินค้าหมดอายุ';
  } else if (risk_level === 'critical') {
    if (will_expire_before_consumed) {
      recommended_action = `เร่งระบายสต็อก ${quantity - estimated_consumption_before_expiry} ชิ้น ก่อนหมดอายุ`;
    } else {
      recommended_action = 'เร่งใช้งานตามลำดับ FEFO';
    }
  } else if (risk_level === 'warning') {
    if (will_expire_before_consumed) {
      recommended_action = 'วางแผนระบายสต็อกหรือโปรโมชั่น';
    } else {
      recommended_action = 'ติดตามและใช้งานตามลำดับ FEFO';
    }
  } else {
    recommended_action = 'สต็อกปกติ ไม่ต้องดำเนินการ';
  }

  return {
    sku_id,
    sku_name,
    location_id,
    lot_no,
    expiry_date,
    days_until_expiry,
    quantity,
    risk_level,
    estimated_consumption_before_expiry,
    will_expire_before_consumed,
    recommended_action,
  };
}

// ============================================
// Aggregate Risk Summary
// ============================================

export interface RiskSummary {
  shortage: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    total_at_risk: number;
  };
  overstock: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    total_excess_qty: number;
  };
  expiry: {
    expired_count: number;
    critical_count: number;
    warning_count: number;
    total_at_risk_qty: number;
  };
  overall_health_score: number; // 0-100
}

export function calculateRiskSummary(
  shortageRisks: ShortageRisk[],
  overstockRisks: OverstockRisk[],
  expiryRisks: ExpiryRisk[]
): RiskSummary {
  const shortage = {
    critical_count: shortageRisks.filter((r) => r.risk_level === 'critical').length,
    high_count: shortageRisks.filter((r) => r.risk_level === 'high').length,
    medium_count: shortageRisks.filter((r) => r.risk_level === 'medium').length,
    total_at_risk: shortageRisks.filter((r) => r.risk_level !== 'low').length,
  };

  const overstock = {
    critical_count: overstockRisks.filter((r) => r.risk_level === 'critical').length,
    high_count: overstockRisks.filter((r) => r.risk_level === 'high').length,
    medium_count: overstockRisks.filter((r) => r.risk_level === 'medium').length,
    total_excess_qty: overstockRisks.reduce((sum, r) => sum + r.excess_qty, 0),
  };

  const expiry = {
    expired_count: expiryRisks.filter((r) => r.risk_level === 'expired').length,
    critical_count: expiryRisks.filter((r) => r.risk_level === 'critical').length,
    warning_count: expiryRisks.filter((r) => r.risk_level === 'warning').length,
    total_at_risk_qty: expiryRisks
      .filter((r) => r.will_expire_before_consumed)
      .reduce((sum, r) => sum + r.quantity, 0),
  };

  // Calculate overall health score
  const totalItems =
    shortageRisks.length + overstockRisks.length + expiryRisks.length;
  const criticalIssues =
    shortage.critical_count + overstock.critical_count + expiry.expired_count;
  const highIssues =
    shortage.high_count + overstock.high_count + expiry.critical_count;

  let healthScore = 100;
  if (totalItems > 0) {
    healthScore -= (criticalIssues / totalItems) * 50;
    healthScore -= (highIssues / totalItems) * 25;
  }

  return {
    shortage,
    overstock,
    expiry,
    overall_health_score: Math.max(0, Math.round(healthScore)),
  };
}

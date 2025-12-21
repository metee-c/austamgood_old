/**
 * Consumption Engine
 * Calculates consumption metrics from historical movement data
 *
 * NOTE: This is a DERIVED calculation, not stored data
 * Results should be clearly labeled as "calculated from historical data"
 */

// ============================================
// Types
// ============================================

export interface ConsumptionMetrics {
  sku_id: string;
  sku_name?: string;
  period_days: number;
  total_outbound_qty: number;
  avg_daily_consumption: number;
  current_stock: number;
  estimated_days_of_cover: number | null;
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
  calculation_note: string;
}

export interface ConsumptionCalculationParams {
  sku_id?: string;
  warehouse_id?: string;
  period_days?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_PERIOD_DAYS = 30;
const MIN_DATA_POINTS_HIGH_CONFIDENCE = 20;
const MIN_DATA_POINTS_MEDIUM_CONFIDENCE = 10;

export const CONSUMPTION_DISCLAIMER = `
Warning: Limitations of this calculation:
1. Calculated from outbound history, not actual usage data
2. Does not include internal consumption
3. May not reflect future usage patterns
4. Should be used as reference only, not as forecast
`;

// ============================================
// Confidence Calculation
// ============================================

export function calculateConfidence(
  dataPoints: number
): 'high' | 'medium' | 'low' {
  if (dataPoints >= MIN_DATA_POINTS_HIGH_CONFIDENCE) {
    return 'high';
  } else if (dataPoints >= MIN_DATA_POINTS_MEDIUM_CONFIDENCE) {
    return 'medium';
  }
  return 'low';
}

// ============================================
// SQL Queries for Consumption Calculation
// ============================================

export function getConsumptionSQL(
  params: ConsumptionCalculationParams
): string {
  const periodDays = params.period_days || DEFAULT_PERIOD_DAYS;

  let whereClause = `
    WHERE l.direction = 'out'
    AND l.movement_at >= NOW() - INTERVAL '${periodDays} days'
  `;

  if (params.sku_id) {
    whereClause += ` AND l.sku_id = '${params.sku_id}'`;
  }

  if (params.warehouse_id) {
    whereClause += ` AND l.warehouse_id = '${params.warehouse_id}'`;
  }

  return `
    WITH outbound_summary AS (
      SELECT 
        l.sku_id,
        s.sku_name,
        COUNT(*) as movement_count,
        SUM(l.piece_qty) as total_outbound_qty,
        ${periodDays} as period_days
      FROM wms_inventory_ledger l
      LEFT JOIN master_sku s ON l.sku_id = s.sku_id
      ${whereClause}
      GROUP BY l.sku_id, s.sku_name
    ),
    current_stock AS (
      SELECT 
        sku_id,
        SUM(total_piece_qty) as current_qty
      FROM wms_inventory_balances
      ${params.warehouse_id ? `WHERE warehouse_id = '${params.warehouse_id}'` : ''}
      GROUP BY sku_id
    )
    SELECT 
      o.sku_id,
      o.sku_name,
      o.period_days,
      o.total_outbound_qty,
      o.movement_count as data_points,
      ROUND(o.total_outbound_qty / o.period_days, 2) as avg_daily_consumption,
      COALESCE(c.current_qty, 0) as current_stock,
      CASE 
        WHEN o.total_outbound_qty > 0 THEN 
          ROUND(COALESCE(c.current_qty, 0) / (o.total_outbound_qty / o.period_days), 1)
        ELSE NULL
      END as estimated_days_of_cover
    FROM outbound_summary o
    LEFT JOIN current_stock c ON o.sku_id = c.sku_id
    ORDER BY o.total_outbound_qty DESC
  `;
}

// ============================================
// Format Consumption Response
// ============================================

export function formatConsumptionResponse(
  metrics: ConsumptionMetrics[]
): string {
  if (!metrics || metrics.length === 0) {
    return 'No outbound movement data found for the specified period';
  }

  let response = `Consumption Analysis (calculated from outbound history)\n\n`;
  response += `Note: This data is calculated from movement history, not stored directly\n\n`;

  metrics.slice(0, 10).forEach((m, index) => {
    const confidenceIcon =
      m.confidence === 'high'
        ? '[HIGH]'
        : m.confidence === 'medium'
          ? '[MED]'
          : '[LOW]';

    response += `${index + 1}. ${m.sku_name || m.sku_id}\n`;
    response += `   - Avg consumption: ${m.avg_daily_consumption.toLocaleString()} pcs/day\n`;
    response += `   - Current stock: ${m.current_stock.toLocaleString()} pcs\n`;

    if (m.estimated_days_of_cover !== null) {
      response += `   - Est. days of cover: ~${m.estimated_days_of_cover} days\n`;
    } else {
      response += `   - Est. days of cover: N/A\n`;
    }

    response += `   - Confidence: ${confidenceIcon} (${m.data_points} data points)\n\n`;
  });

  response += `\nCalculated from ${metrics[0]?.period_days || 30} days of data`;

  return response;
}

export const CONSUMPTION_ALTERNATIVE_RESPONSE = `
The system does not store daily consumption rate directly.

However, I can calculate from outbound history:

Try asking:
1. "Calculate consumption rate from 30 day history"
2. "Analyze outbound movements for SKU-XXX"
3. "Estimate stock usage from historical data"

Note: Results are estimates from historical data, not forecasts.
`;

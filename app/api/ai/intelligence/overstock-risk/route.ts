/**
 * Intelligence API: Overstock Risk
 * GET /api/ai/intelligence/overstock-risk
 *
 * Returns SKUs with excess inventory
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, OverstockRisk, calculateConfidence } from '@/lib/intelligence/types';
import { calculateOverstockRisk, RISK_THRESHOLDS } from '@/lib/intelligence/risk-engine';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');
    const min_risk_level = searchParams.get('min_risk_level') || 'medium';

    // Get current stock balances
    let stockQuery = supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty');

    if (sku_id) stockQuery = stockQuery.eq('sku_id', sku_id);
    if (warehouse_id) stockQuery = stockQuery.eq('warehouse_id', warehouse_id);

    const { data: stockData, error: stockError } = await stockQuery;

    if (stockError) {
      return NextResponse.json({ success: false, error: stockError.message }, { status: 500 });
    }

    // Aggregate stock by SKU
    const stockMap = new Map<string, number>();
    stockData?.forEach((item) => {
      const existing = stockMap.get(item.sku_id) || 0;
      stockMap.set(item.sku_id, existing + Number(item.total_piece_qty || 0));
    });

    // Get consumption data
    let consumptionQuery = supabase
      .from('wms_inventory_ledger')
      .select('sku_id, piece_qty')
      .eq('direction', 'out')
      .gte('movement_at', new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString());

    if (sku_id) consumptionQuery = consumptionQuery.eq('sku_id', sku_id);
    if (warehouse_id) consumptionQuery = consumptionQuery.eq('warehouse_id', warehouse_id);

    const { data: consumptionData } = await consumptionQuery;

    // Aggregate consumption by SKU
    const consumptionMap = new Map<string, { total: number; count: number }>();
    consumptionData?.forEach((item) => {
      const existing = consumptionMap.get(item.sku_id) || { total: 0, count: 0 };
      consumptionMap.set(item.sku_id, {
        total: existing.total + Number(item.piece_qty || 0),
        count: existing.count + 1,
      });
    });

    // Get SKU master data
    const skuIds = Array.from(stockMap.keys());
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, shelf_life_days')
      .in('sku_id', skuIds.length > 0 ? skuIds : ['']);

    const skuMasterMap = new Map(skuData?.map((s) => [s.sku_id, s]) || []);

    // Calculate overstock risk for each SKU
    const risks: OverstockRisk[] = Array.from(stockMap.entries()).map(([sku_id, stock]) => {
      const consumption = consumptionMap.get(sku_id) || { total: 0, count: 0 };
      const skuMaster = skuMasterMap.get(sku_id);
      const avg_daily = consumption.total / period_days;

      return calculateOverstockRisk({
        sku_id,
        sku_name: skuMaster?.sku_name || sku_id,
        current_stock: stock,
        avg_daily_consumption: avg_daily,
        shelf_life_days: skuMaster?.shelf_life_days,
        data_points: consumption.count,
      });
    });

    // Filter by minimum risk level
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const minRiskOrder = riskOrder[min_risk_level] ?? 2;

    const filteredRisks = risks
      .filter((r) => riskOrder[r.risk_level] <= minRiskOrder)
      .sort((a, b) => {
        if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
          return riskOrder[a.risk_level] - riskOrder[b.risk_level];
        }
        return b.risk_score - a.risk_score;
      });

    // Summary
    const summary = {
      total_skus_analyzed: risks.length,
      critical_count: risks.filter((r) => r.risk_level === 'critical').length,
      high_count: risks.filter((r) => r.risk_level === 'high').length,
      medium_count: risks.filter((r) => r.risk_level === 'medium').length,
      low_count: risks.filter((r) => r.risk_level === 'low').length,
      total_excess_qty: risks.reduce((sum, r) => sum + r.excess_qty, 0),
      thresholds: RISK_THRESHOLDS.overstock,
    };

    const totalDataPoints = consumptionData?.length || 0;
    const avgConfidence = calculateConfidence(Math.round(totalDataPoints / Math.max(1, risks.length)));

    const response: IntelligenceResponse<{ risks: OverstockRisk[]; summary: typeof summary }> = {
      success: true,
      data: { risks: filteredRisks, summary },
      metadata: {
        calculation_method: 'days_of_cover_vs_optimal_threshold',
        data_window: `last_${period_days}_days`,
        data_points: totalDataPoints,
        confidence_level: avgConfidence.level,
        confidence_percent: avgConfidence.percent,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'ประเมินจากอัตราการใช้ในอดีต สต็อกเกินอาจเหมาะสมหากมีแผนโปรโมชั่น',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Overstock Risk API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

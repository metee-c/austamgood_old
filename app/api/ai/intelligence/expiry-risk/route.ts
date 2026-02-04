/**
 * Intelligence API: Expiry Risk
 * GET /api/ai/intelligence/expiry-risk
 *
 * Returns inventory at risk of expiration
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, ExpiryRisk, calculateConfidence } from '@/lib/intelligence/types';
import { calculateExpiryRisk, RISK_THRESHOLDS } from '@/lib/intelligence/risk-engine';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const location_id = searchParams.get('location_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');
    const days_threshold = parseInt(searchParams.get('days_threshold') || '90');

    // Get inventory with expiry dates
    let stockQuery = supabase
      .from('wms_inventory_balances')
      .select('sku_id, location_id, lot_no, expiry_date, total_piece_qty')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', new Date(Date.now() + days_threshold * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (sku_id) stockQuery = stockQuery.eq('sku_id', sku_id);
    if (warehouse_id) stockQuery = stockQuery.eq('warehouse_id', warehouse_id);
    if (location_id) stockQuery = stockQuery.eq('location_id', location_id);

    const { data: stockData, error: stockError } = await stockQuery;

    if (stockError) {
      return NextResponse.json({ success: false, error: stockError.message }, { status: 500 });
    }

    // Get consumption data for estimating if stock will be used before expiry
    let consumptionQuery = supabase
      .from('wms_inventory_ledger')
      .select('sku_id, piece_qty')
      .eq('direction', 'out')
      .gte('movement_at', new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString());

    if (warehouse_id) consumptionQuery = consumptionQuery.eq('warehouse_id', warehouse_id);

    const { data: consumptionData } = await consumptionQuery;

    // Aggregate consumption by SKU
    const consumptionMap = new Map<string, number>();
    consumptionData?.forEach((item) => {
      const existing = consumptionMap.get(item.sku_id) || 0;
      consumptionMap.set(item.sku_id, existing + Number(item.piece_qty || 0));
    });

    // Get SKU names
    const skuIds = [...new Set(stockData?.map((s) => s.sku_id) || [])];
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name')
      .in('sku_id', skuIds.length > 0 ? skuIds : ['']);

    const skuNameMap = new Map(skuData?.map((s) => [s.sku_id, s.sku_name]) || []);

    // Calculate expiry risk for each inventory record
    const risks: ExpiryRisk[] = (stockData || []).map((item) => {
      const consumption = consumptionMap.get(item.sku_id) || 0;
      const avg_daily = consumption / period_days;

      return calculateExpiryRisk({
        sku_id: item.sku_id,
        sku_name: skuNameMap.get(item.sku_id) || item.sku_id,
        location_id: item.location_id,
        lot_no: item.lot_no,
        expiry_date: item.expiry_date,
        quantity: Number(item.total_piece_qty || 0),
        avg_daily_consumption: avg_daily,
      });
    }).sort((a, b) => a.days_until_expiry - b.days_until_expiry);

    // Summary
    const summary = {
      total_items_analyzed: risks.length,
      expired_count: risks.filter((r) => r.risk_level === 'expired').length,
      critical_count: risks.filter((r) => r.risk_level === 'critical').length,
      warning_count: risks.filter((r) => r.risk_level === 'warning').length,
      normal_count: risks.filter((r) => r.risk_level === 'normal').length,
      total_expired_qty: risks
        .filter((r) => r.risk_level === 'expired')
        .reduce((sum, r) => sum + r.quantity, 0),
      total_at_risk_qty: risks
        .filter((r) => r.will_expire_before_consumed)
        .reduce((sum, r) => sum + r.quantity, 0),
      thresholds: RISK_THRESHOLDS.expiry,
    };

    const totalDataPoints = consumptionData?.length || 0;
    const avgConfidence = calculateConfidence(Math.round(totalDataPoints / Math.max(1, skuIds.length)));

    const response: IntelligenceResponse<{ risks: ExpiryRisk[]; summary: typeof summary }> = {
      success: true,
      data: { risks, summary },
      metadata: {
        calculation_method: 'expiry_date_vs_estimated_consumption',
        data_window: `expiry_within_${days_threshold}_days`,
        data_points: totalDataPoints,
        confidence_level: avgConfidence.level,
        confidence_percent: avgConfidence.percent,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'ประเมินจากอัตราการใช้ในอดีต สินค้าอาจถูกใช้เร็วกว่าหรือช้ากว่าที่ประมาณ',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Expiry Risk API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

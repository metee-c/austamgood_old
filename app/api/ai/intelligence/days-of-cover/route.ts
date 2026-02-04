/**
 * Intelligence API: Days of Cover
 * GET /api/ai/intelligence/days-of-cover
 *
 * Returns estimated days of cover based on consumption rate
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, DaysOfCoverResult, calculateConfidence } from '@/lib/intelligence/types';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');
    const risk_threshold = parseInt(searchParams.get('risk_threshold') || '14');

    // Get current stock balances
    let stockQuery = supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty');

    if (sku_id) stockQuery = stockQuery.eq('sku_id', sku_id);
    if (warehouse_id) stockQuery = stockQuery.eq('warehouse_id', warehouse_id);

    const { data: stockData, error: stockError } = await stockQuery;

    if (stockError) {
      return NextResponse.json({ success: false, error: stockError.message }, { status: 500 });
    }

    // Aggregate stock by SKU
    const stockMap = new Map<string, { total: number; reserved: number }>();
    stockData?.forEach((item) => {
      const existing = stockMap.get(item.sku_id) || { total: 0, reserved: 0 };
      stockMap.set(item.sku_id, {
        total: existing.total + Number(item.total_piece_qty || 0),
        reserved: existing.reserved + Number(item.reserved_piece_qty || 0),
      });
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
      .select('sku_id, sku_name, reorder_point, safety_stock')
      .in('sku_id', skuIds.length > 0 ? skuIds : ['']);

    const skuMasterMap = new Map(skuData?.map((s) => [s.sku_id, s]) || []);

    // Calculate days of cover for each SKU
    const results: DaysOfCoverResult[] = Array.from(stockMap.entries()).map(([sku_id, stock]) => {
      const consumption = consumptionMap.get(sku_id) || { total: 0, count: 0 };
      const skuMaster = skuMasterMap.get(sku_id);
      const avg_daily = consumption.total / period_days;
      const available = stock.total - stock.reserved;

      let days_of_cover: number | null = null;
      let risk_level: DaysOfCoverResult['risk_level'] = 'normal';

      if (avg_daily > 0) {
        days_of_cover = Math.round(available / avg_daily);

        if (days_of_cover <= 3) risk_level = 'critical';
        else if (days_of_cover <= 7) risk_level = 'warning';
        else if (days_of_cover > 90) risk_level = 'excess';
      } else if (stock.total > 0) {
        risk_level = 'excess'; // No consumption = potential dead stock
      }

      const confidence = calculateConfidence(consumption.count);

      return {
        sku_id,
        sku_name: skuMaster?.sku_name || sku_id,
        current_stock: stock.total,
        reserved_qty: stock.reserved,
        available_qty: available,
        avg_daily_consumption: Math.round(avg_daily * 100) / 100,
        days_of_cover,
        risk_level,
        reorder_point: skuMaster?.reorder_point || null,
        safety_stock: skuMaster?.safety_stock || null,
        confidence: confidence.level,
      };
    }).sort((a, b) => {
      // Sort by risk: critical first, then by days of cover ascending
      const riskOrder = { critical: 0, warning: 1, normal: 2, excess: 3 };
      if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
        return riskOrder[a.risk_level] - riskOrder[b.risk_level];
      }
      return (a.days_of_cover || 999) - (b.days_of_cover || 999);
    });

    // Filter by risk threshold if specified
    const filteredResults = results.filter((r) => 
      r.days_of_cover === null || r.days_of_cover <= risk_threshold || r.risk_level !== 'normal'
    );

    const totalDataPoints = consumptionData?.length || 0;
    const avgConfidence = calculateConfidence(Math.round(totalDataPoints / Math.max(1, results.length)));

    const response: IntelligenceResponse<DaysOfCoverResult[]> = {
      success: true,
      data: filteredResults,
      metadata: {
        calculation_method: 'stock_balance_divided_by_avg_daily_consumption',
        data_window: `last_${period_days}_days`,
        data_points: totalDataPoints,
        confidence_level: avgConfidence.level,
        confidence_percent: avgConfidence.percent,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'ประมาณการจากอัตราการใช้ในอดีต อาจไม่สะท้อนการใช้ในอนาคต',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Days of Cover API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

/**
 * Intelligence API: Shortage Risk
 * GET /api/ai/intelligence/shortage-risk
 *
 * Returns SKUs at risk of stockout
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, ShortageRisk, calculateConfidence } from '@/lib/intelligence/types';
import { calculateShortageRisk, RISK_THRESHOLDS } from '@/lib/intelligence/risk-engine';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');
    const min_risk_level = searchParams.get('min_risk_level') || 'medium'; // critical, high, medium, low

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

    // Get pending orders (confirmed but not shipped)
    const { data: pendingOrders } = await supabase
      .from('wms_order_items')
      .select('sku_id, qty, picked_qty, orders:wms_orders!inner(status)')
      .in('orders.status', ['confirmed', 'in_picking']);

    // Aggregate pending by SKU
    const pendingMap = new Map<string, number>();
    pendingOrders?.forEach((item: any) => {
      const remaining = Number(item.qty || 0) - Number(item.picked_qty || 0);
      if (remaining > 0) {
        const existing = pendingMap.get(item.sku_id) || 0;
        pendingMap.set(item.sku_id, existing + remaining);
      }
    });

    // Get SKU master data
    const skuIds = Array.from(stockMap.keys());
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name, reorder_point')
      .in('sku_id', skuIds.length > 0 ? skuIds : ['']);

    const skuMasterMap = new Map(skuData?.map((s) => [s.sku_id, s]) || []);

    // Calculate shortage risk for each SKU
    const risks: ShortageRisk[] = Array.from(stockMap.entries()).map(([sku_id, stock]) => {
      const consumption = consumptionMap.get(sku_id) || { total: 0, count: 0 };
      const skuMaster = skuMasterMap.get(sku_id);
      const pending = pendingMap.get(sku_id) || 0;
      const avg_daily = consumption.total / period_days;

      return calculateShortageRisk({
        sku_id,
        sku_name: skuMaster?.sku_name || sku_id,
        current_stock: stock.total,
        reserved_qty: stock.reserved,
        avg_daily_consumption: avg_daily,
        pending_orders_qty: pending,
        reorder_point: skuMaster?.reorder_point,
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
      thresholds: RISK_THRESHOLDS.shortage,
    };

    const totalDataPoints = consumptionData?.length || 0;
    const avgConfidence = calculateConfidence(Math.round(totalDataPoints / Math.max(1, risks.length)));

    const response: IntelligenceResponse<{ risks: ShortageRisk[]; summary: typeof summary }> = {
      success: true,
      data: { risks: filteredRisks, summary },
      metadata: {
        calculation_method: 'days_of_cover_with_pending_orders',
        data_window: `last_${period_days}_days`,
        data_points: totalDataPoints,
        confidence_level: avgConfidence.level,
        confidence_percent: avgConfidence.percent,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'ประเมินจากอัตราการใช้ในอดีต ไม่รวมปัจจัยภายนอก เช่น โปรโมชั่น หรือฤดูกาล',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Shortage Risk API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

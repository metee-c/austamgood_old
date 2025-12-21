/**
 * AI Stock Consumption API
 * GET /api/ai/stock/consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MIN_DATA_POINTS_HIGH = 20;
const MIN_DATA_POINTS_MED = 10;

const DISCLAIMER = 'Calculated from outbound history, not actual usage data.';

function getConfidence(pts: number): 'high' | 'medium' | 'low' {
  if (pts >= MIN_DATA_POINTS_HIGH) return 'high';
  if (pts >= MIN_DATA_POINTS_MED) return 'medium';
  return 'low';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('wms_inventory_ledger')
      .select('sku_id, piece_qty')
      .eq('direction', 'out')
      .gte(
        'movement_at',
        new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString()
      );

    if (sku_id) query = query.eq('sku_id', sku_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);

    const { data: ledgerData, error: ledgerError } = await query;

    if (ledgerError) {
      return NextResponse.json(
        { success: false, error: ledgerError.message },
        { status: 500 }
      );
    }

    const skuMap = new Map<string, { total_qty: number; count: number }>();
    ledgerData?.forEach((item) => {
      const existing = skuMap.get(item.sku_id) || { total_qty: 0, count: 0 };
      skuMap.set(item.sku_id, {
        total_qty: existing.total_qty + Number(item.piece_qty || 0),
        count: existing.count + 1,
      });
    });

    const skuIds = Array.from(skuMap.keys());
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name')
      .in('sku_id', skuIds);

    const skuNameMap = new Map(
      skuData?.map((s) => [s.sku_id, s.sku_name]) || []
    );

    let stockQuery = supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty')
      .in('sku_id', skuIds);

    if (warehouse_id) stockQuery = stockQuery.eq('warehouse_id', warehouse_id);

    const { data: stockData } = await stockQuery;

    const stockMap = new Map<string, number>();
    stockData?.forEach((item) => {
      const existing = stockMap.get(item.sku_id) || 0;
      stockMap.set(item.sku_id, existing + Number(item.total_piece_qty || 0));
    });

    const consumptionData = Array.from(skuMap.entries())
      .map(([id, data]) => {
        const avg = data.total_qty / period_days;
        const stock = stockMap.get(id) || 0;
        const cover = avg > 0 ? Math.round(stock / avg) : null;

        return {
          sku_id: id,
          sku_name: skuNameMap.get(id) || id,
          period_days,
          total_outbound_qty: data.total_qty,
          avg_daily_consumption: Math.round(avg * 100) / 100,
          current_stock: stock,
          estimated_days_of_cover: cover,
          confidence: getConfidence(data.count),
          data_points: data.count,
        };
      })
      .sort((a, b) => b.total_outbound_qty - a.total_outbound_qty)
      .slice(0, limit);

    const totalOutbound = consumptionData.reduce(
      (sum, item) => sum + item.total_outbound_qty,
      0
    );

    return NextResponse.json({
      success: true,
      data: consumptionData,
      summary: {
        period_days,
        total_skus_analyzed: consumptionData.length,
        total_outbound_qty: totalOutbound,
        avg_daily_outbound: Math.round((totalOutbound / period_days) * 100) / 100,
        calculation_method: 'derived_from_ledger',
        disclaimer: DISCLAIMER,
      },
      filters: {
        sku_id: sku_id || 'all',
        warehouse_id: warehouse_id || 'all',
        period_days,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AI Consumption API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Intelligence API: Consumption
 * GET /api/ai/intelligence/consumption
 *
 * Returns SKU consumption metrics with trend analysis
 * DETERMINISTIC: Math + aggregation only, NO AI/guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntelligenceResponse, SKUConsumptionProfile, calculateConfidence } from '@/lib/intelligence/types';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const sku_id = searchParams.get('sku_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const period_days = parseInt(searchParams.get('period_days') || '30');

    // Query outbound movements for current period
    let query = supabase
      .from('wms_inventory_ledger')
      .select('sku_id, piece_qty, movement_at')
      .eq('direction', 'out')
      .gte('movement_at', new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString());

    if (sku_id) query = query.eq('sku_id', sku_id);
    if (warehouse_id) query = query.eq('warehouse_id', warehouse_id);

    const { data: currentPeriod, error: currentError } = await query;

    if (currentError) {
      return NextResponse.json({ success: false, error: currentError.message }, { status: 500 });
    }

    // Query previous period for trend calculation
    const prevStart = new Date(Date.now() - period_days * 2 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000);

    let prevQuery = supabase
      .from('wms_inventory_ledger')
      .select('sku_id, piece_qty')
      .eq('direction', 'out')
      .gte('movement_at', prevStart.toISOString())
      .lt('movement_at', prevEnd.toISOString());

    if (sku_id) prevQuery = prevQuery.eq('sku_id', sku_id);
    if (warehouse_id) prevQuery = prevQuery.eq('warehouse_id', warehouse_id);

    const { data: previousPeriod } = await prevQuery;

    // Aggregate current period by SKU
    const currentMap = new Map<string, { total: number; count: number; daily: number[] }>();
    currentPeriod?.forEach((item) => {
      const existing = currentMap.get(item.sku_id) || { total: 0, count: 0, daily: [] };
      const qty = Number(item.piece_qty || 0);
      existing.total += qty;
      existing.count += 1;
      currentMap.set(item.sku_id, existing);
    });

    // Aggregate previous period by SKU
    const prevMap = new Map<string, number>();
    previousPeriod?.forEach((item) => {
      const existing = prevMap.get(item.sku_id) || 0;
      prevMap.set(item.sku_id, existing + Number(item.piece_qty || 0));
    });

    // Get SKU names
    const skuIds = Array.from(currentMap.keys());
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('sku_id, sku_name')
      .in('sku_id', skuIds.length > 0 ? skuIds : ['']);

    const skuNameMap = new Map(skuData?.map((s) => [s.sku_id, s.sku_name]) || []);

    // Build consumption profiles
    const profiles: SKUConsumptionProfile[] = Array.from(currentMap.entries()).map(([sku_id, data]) => {
      const avg_daily = data.total / period_days;
      const prevTotal = prevMap.get(sku_id) || 0;
      const prevAvg = prevTotal / period_days;

      // Calculate trend
      let trend_30d = 0;
      if (prevAvg > 0) {
        trend_30d = Math.round(((avg_daily - prevAvg) / prevAvg) * 100);
      }

      const confidence = calculateConfidence(data.count);

      return {
        sku_id,
        sku_name: skuNameMap.get(sku_id) || sku_id,
        avg_daily_consumption: Math.round(avg_daily * 100) / 100,
        min_daily_consumption: 0, // Would need daily aggregation
        max_daily_consumption: 0, // Would need daily aggregation
        std_deviation: 0, // Would need daily aggregation
        coefficient_of_variation: 0,
        trend_7d: 0, // Would need 7d specific query
        trend_30d,
        seasonality_factor: 1.0,
        data_points: data.count,
        confidence: confidence.level,
      };
    }).sort((a, b) => b.avg_daily_consumption - a.avg_daily_consumption);

    const response: IntelligenceResponse<SKUConsumptionProfile[]> = {
      success: true,
      data: profiles,
      metadata: {
        calculation_method: 'aggregation_from_inventory_ledger',
        data_window: `last_${period_days}_days`,
        data_points: currentPeriod?.length || 0,
        confidence_level: profiles.length > 0 ? profiles[0].confidence : 'low',
        confidence_percent: profiles.length > 0 ? calculateConfidence(profiles[0].data_points).percent : 0,
        generated_at: new Date().toISOString(),
      },
      disclaimer: 'คำนวณจากประวัติการจ่ายออก ไม่ใช่ข้อมูลการใช้จริง',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Intelligence Consumption API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);

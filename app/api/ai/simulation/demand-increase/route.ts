/**
 * Demand Increase Simulation API
 * POST /api/ai/simulation/demand-increase
 * 
 * Simulates the impact of increased demand on warehouse operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScenarioEngine, DemandScenarioParams, SIMULATION_DISCLAIMER } from '@/lib/simulation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { demand_multiplier, period_days } = body;

    // Validate parameters
    if (demand_multiplier === undefined || demand_multiplier === null) {
      return NextResponse.json(
        { success: false, error: 'demand_multiplier is required' },
        { status: 400 }
      );
    }

    if (typeof demand_multiplier !== 'number' || demand_multiplier <= 0) {
      return NextResponse.json(
        { success: false, error: 'demand_multiplier must be a positive number' },
        { status: 400 }
      );
    }

    if (demand_multiplier > 10) {
      return NextResponse.json(
        { success: false, error: 'demand_multiplier cannot exceed 10 (1000% increase)' },
        { status: 400 }
      );
    }

    // Create scenario engine and run simulation
    const engine = await createScenarioEngine();
    
    const params: DemandScenarioParams = {
      demand_multiplier,
      period_days: period_days || 30,
    };

    const result = engine.runDemandIncrease(params);

    return NextResponse.json({
      success: true,
      data: {
        scenario_id: result.scenario_id,
        scenario_type: result.scenario_type,
        scenario_name: result.scenario_name,
        parameters: result.parameters,
        kpi_delta: result.kpi_delta,
        bottlenecks: result.bottlenecks,
        risks: result.risks,
        summary: {
          baseline_throughput: result.baseline.throughput.outbound.avg_daily_qty,
          simulated_throughput: result.simulated.throughput.outbound.avg_daily_qty,
          throughput_change_percent: result.kpi_delta.throughput.percent_delta,
          baseline_utilization: result.baseline.storage.summary.utilization_percent,
          simulated_utilization: result.simulated.storage.summary.utilization_percent,
          bottleneck_count: result.bottlenecks.length,
          risk_count: result.risks.length,
        },
      },
      metadata: {
        calculation_method: result.calculation_method,
        data_sources: ['wms_inventory_ledger', 'wms_orders', 'master_location'],
        data_period: `${params.period_days} days`,
        confidence_level: result.confidence_level,
        generated_at: result.timestamp,
      },
      disclaimer: SIMULATION_DISCLAIMER,
    });

  } catch (error) {
    console.error('[Simulation API] Demand increase error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Simulation failed',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/ai/simulation/demand-increase',
    method: 'POST',
    description: 'Simulate the impact of increased demand on warehouse operations',
    parameters: {
      demand_multiplier: {
        type: 'number',
        required: true,
        description: 'Multiplier for demand (e.g., 1.2 for 20% increase, 2.0 for 100% increase)',
        min: 0.1,
        max: 10,
      },
      period_days: {
        type: 'number',
        required: false,
        default: 30,
        description: 'Historical data period in days',
      },
    },
    example: {
      demand_multiplier: 1.5,
      period_days: 30,
    },
  });
}

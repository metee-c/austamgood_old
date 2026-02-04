/**
 * Lead Time Increase Simulation API
 * POST /api/ai/simulation/lead-time-increase
 * 
 * Simulates the impact of increased supplier lead times on inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScenarioEngine, LeadTimeScenarioParams, SIMULATION_DISCLAIMER } from '@/lib/simulation';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    const { lead_time_increase_days, supplier_ids } = body;

    // Validate parameters
    if (lead_time_increase_days === undefined || lead_time_increase_days === null) {
      return NextResponse.json(
        { success: false, error: 'lead_time_increase_days is required' },
        { status: 400 }
      );
    }

    if (typeof lead_time_increase_days !== 'number' || lead_time_increase_days < 0) {
      return NextResponse.json(
        { success: false, error: 'lead_time_increase_days must be a non-negative number' },
        { status: 400 }
      );
    }

    if (lead_time_increase_days > 90) {
      return NextResponse.json(
        { success: false, error: 'lead_time_increase_days cannot exceed 90 days' },
        { status: 400 }
      );
    }

    // Create scenario engine and run simulation
    const engine = await createScenarioEngine();
    
    const params: LeadTimeScenarioParams = {
      lead_time_increase_days,
      supplier_ids: supplier_ids || undefined,
    };

    const result = engine.runLeadTimeIncrease(params);

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
          baseline_avg_lead_time: result.baseline.leadTime.overall.avg_lead_time,
          simulated_avg_lead_time: result.simulated.leadTime.overall.avg_lead_time,
          lead_time_increase: lead_time_increase_days,
          high_variability_suppliers: result.simulated.leadTime.high_variability_suppliers.length,
          affected_suppliers: supplier_ids?.length || result.baseline.leadTime.suppliers.length,
          risk_count: result.risks.length,
        },
      },
      metadata: {
        calculation_method: result.calculation_method,
        data_sources: ['receiving_orders', 'master_supplier'],
        data_period: '90 days',
        confidence_level: result.confidence_level,
        generated_at: result.timestamp,
      },
      disclaimer: SIMULATION_DISCLAIMER,
    });

  } catch (error) {
    console.error('[Simulation API] Lead time increase error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Simulation failed',
      },
      { status: 500 }
    );
  }
}

async function _GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/ai/simulation/lead-time-increase',
    method: 'POST',
    description: 'Simulate the impact of increased supplier lead times on inventory',
    parameters: {
      lead_time_increase_days: {
        type: 'number',
        required: true,
        description: 'Number of days to add to supplier lead times',
        min: 0,
        max: 90,
      },
      supplier_ids: {
        type: 'array',
        required: false,
        description: 'Specific supplier IDs to apply increase to (all suppliers if not specified)',
      },
    },
    example: {
      lead_time_increase_days: 7,
      supplier_ids: null,
    },
  });
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);

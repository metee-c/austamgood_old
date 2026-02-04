/**
 * Shift Change Simulation API
 * POST /api/ai/simulation/shift-change
 * 
 * Simulates the impact of workforce and shift changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScenarioEngine, ShiftScenarioParams, SIMULATION_DISCLAIMER } from '@/lib/simulation';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    const { shift_hours_change, worker_count_change, productivity_change_percent } = body;

    // Validate parameters - at least one must be provided
    if (
      shift_hours_change === undefined &&
      worker_count_change === undefined &&
      productivity_change_percent === undefined
    ) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'At least one parameter is required: shift_hours_change, worker_count_change, or productivity_change_percent' 
        },
        { status: 400 }
      );
    }

    // Validate ranges
    if (shift_hours_change !== undefined) {
      if (typeof shift_hours_change !== 'number' || shift_hours_change < -8 || shift_hours_change > 8) {
        return NextResponse.json(
          { success: false, error: 'shift_hours_change must be between -8 and 8' },
          { status: 400 }
        );
      }
    }

    if (worker_count_change !== undefined) {
      if (typeof worker_count_change !== 'number' || worker_count_change < -100 || worker_count_change > 200) {
        return NextResponse.json(
          { success: false, error: 'worker_count_change must be between -100 and 200 (percent)' },
          { status: 400 }
        );
      }
    }

    if (productivity_change_percent !== undefined) {
      if (typeof productivity_change_percent !== 'number' || productivity_change_percent < -50 || productivity_change_percent > 100) {
        return NextResponse.json(
          { success: false, error: 'productivity_change_percent must be between -50 and 100' },
          { status: 400 }
        );
      }
    }

    // Create scenario engine and run simulation
    const engine = await createScenarioEngine();
    
    const params: ShiftScenarioParams = {
      shift_hours_change,
      worker_count_change,
      productivity_change_percent,
    };

    const result = engine.runShiftChange(params);

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
          baseline_headcount: result.baseline.labor.headcount.total,
          simulated_headcount: result.simulated.labor.headcount.total,
          baseline_hours_per_shift: result.baseline.labor.capacity.hours_per_shift,
          simulated_hours_per_shift: result.simulated.labor.capacity.hours_per_shift,
          baseline_picking_capacity: result.baseline.labor.capacity.picking_capacity_qty,
          simulated_picking_capacity: result.simulated.labor.capacity.picking_capacity_qty,
          capacity_change_percent: result.kpi_delta.labor_utilization.percent_delta,
          bottleneck_count: result.bottlenecks.length,
          risk_count: result.risks.length,
        },
      },
      metadata: {
        calculation_method: result.calculation_method,
        data_sources: ['master_employee', 'wms_picklists'],
        data_period: '30 days',
        confidence_level: result.confidence_level,
        generated_at: result.timestamp,
      },
      disclaimer: SIMULATION_DISCLAIMER,
    });

  } catch (error) {
    console.error('[Simulation API] Shift change error:', error);
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
    endpoint: '/api/ai/simulation/shift-change',
    method: 'POST',
    description: 'Simulate the impact of workforce and shift changes',
    parameters: {
      shift_hours_change: {
        type: 'number',
        required: false,
        description: 'Change in shift hours (e.g., -2 for 2 hours less, +2 for 2 hours more)',
        min: -8,
        max: 8,
      },
      worker_count_change: {
        type: 'number',
        required: false,
        description: 'Percentage change in worker count (e.g., -25 for 25% reduction)',
        min: -100,
        max: 200,
      },
      productivity_change_percent: {
        type: 'number',
        required: false,
        description: 'Percentage change in productivity (e.g., 10 for 10% improvement)',
        min: -50,
        max: 100,
      },
    },
    example: {
      worker_count_change: -25,
    },
  });
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);

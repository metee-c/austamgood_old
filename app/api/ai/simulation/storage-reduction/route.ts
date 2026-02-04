/**
 * Storage Reduction Simulation API
 * POST /api/ai/simulation/storage-reduction
 * 
 * Simulates the impact of reduced storage capacity
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScenarioEngine, StorageScenarioParams, SIMULATION_DISCLAIMER } from '@/lib/simulation';
export async function POST(request: NextRequest) {
try {
    const body = await request.json();
    const { reduction_percent, reduction_locations, affected_zones } = body;

    // Validate parameters
    if (reduction_percent === undefined && (!reduction_locations || reduction_locations.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Either reduction_percent or reduction_locations is required' },
        { status: 400 }
      );
    }

    if (reduction_percent !== undefined) {
      if (typeof reduction_percent !== 'number' || reduction_percent < 0 || reduction_percent > 100) {
        return NextResponse.json(
          { success: false, error: 'reduction_percent must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Create scenario engine and run simulation
    const engine = await createScenarioEngine();
    
    const params: StorageScenarioParams = {
      reduction_percent,
      reduction_locations,
      affected_zones,
    };

    const result = engine.runStorageReduction(params);

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
          baseline_capacity: result.baseline.storage.summary.total_capacity,
          simulated_capacity: result.simulated.storage.summary.total_capacity,
          capacity_reduction: result.baseline.storage.summary.total_capacity - result.simulated.storage.summary.total_capacity,
          baseline_utilization: result.baseline.storage.summary.utilization_percent,
          simulated_utilization: result.simulated.storage.summary.utilization_percent,
          overflow_locations: result.simulated.storage.summary.overflow_locations,
          overflow_qty: result.simulated.storage.summary.total_overflow_qty,
          bottleneck_count: result.bottlenecks.length,
          risk_count: result.risks.length,
        },
      },
      metadata: {
        calculation_method: result.calculation_method,
        data_sources: ['master_location', 'wms_inventory_balances'],
        data_period: 'current snapshot',
        confidence_level: result.confidence_level,
        generated_at: result.timestamp,
      },
      disclaimer: SIMULATION_DISCLAIMER,
    });

  } catch (error) {
    console.error('[Simulation API] Storage reduction error:', error);
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
    endpoint: '/api/ai/simulation/storage-reduction',
    method: 'POST',
    description: 'Simulate the impact of reduced storage capacity',
    parameters: {
      reduction_percent: {
        type: 'number',
        required: false,
        description: 'Percentage of storage capacity to reduce (0-100)',
        min: 0,
        max: 100,
      },
      reduction_locations: {
        type: 'array',
        required: false,
        description: 'Specific location IDs to remove from capacity',
      },
      affected_zones: {
        type: 'array',
        required: false,
        description: 'Zones to apply reduction to (all zones if not specified)',
      },
    },
    example: {
      reduction_percent: 20,
      affected_zones: null,
    },
  });
}

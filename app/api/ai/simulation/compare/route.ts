/**
 * Scenario Comparison API
 * POST /api/ai/simulation/compare
 * 
 * Compares multiple scenarios side by side
 */

import { 
NextRequest, NextResponse } from 'next/server';
import { 
  createScenarioEngine, 
  Scenario, 
  ScenarioType,
  SIMULATION_DISCLAIMER,
  generateSimulationId,
} from '@/lib/simulation';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

interface ScenarioInput {
  type: ScenarioType;
  name?: string;
  parameters: Record<string, any>;
}

async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    const { scenarios } = body;

    // Validate parameters
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'scenarios array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (scenarios.length > 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum 5 scenarios can be compared at once' },
        { status: 400 }
      );
    }

    // Validate each scenario
    const validTypes: ScenarioType[] = ['demand_increase', 'lead_time_increase', 'storage_reduction', 'shift_change'];
    
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      if (!s.type || !validTypes.includes(s.type)) {
        return NextResponse.json(
          { success: false, error: `Invalid scenario type at index ${i}. Valid types: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      if (!s.parameters || typeof s.parameters !== 'object') {
        return NextResponse.json(
          { success: false, error: `Missing parameters at index ${i}` },
          { status: 400 }
        );
      }
    }

    // Convert to Scenario objects
    const scenarioObjects: Scenario[] = scenarios.map((s: ScenarioInput, i: number) => ({
      id: `scenario_${i + 1}`,
      type: s.type,
      name: s.name || `Scenario ${i + 1}`,
      description: '',
      parameters: s.parameters,
      created_at: new Date().toISOString(),
    }));

    // Create scenario engine and run comparison
    const engine = await createScenarioEngine();
    const result = engine.compareScenarios(scenarioObjects);

    // Format response
    const scenarioSummaries = result.scenarios.map(({ scenario, result: simResult }) => ({
      id: scenario.id,
      name: scenario.name,
      type: scenario.type,
      parameters: scenario.parameters,
      kpi_delta: simResult.kpi_delta,
      bottleneck_count: simResult.bottlenecks.length,
      risk_count: simResult.risks.length,
      primary_bottleneck: simResult.bottlenecks[0]?.resource_name || null,
      highest_risk: simResult.risks[0]?.risk_type || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        comparison_id: generateSimulationId(),
        baseline_summary: {
          throughput: result.baseline.throughput.outbound.avg_daily_qty,
          utilization: result.baseline.storage.summary.utilization_percent,
          total_capacity: result.baseline.storage.summary.total_capacity,
          headcount: result.baseline.labor.headcount.total,
        },
        scenarios: scenarioSummaries,
        comparison_matrix: result.comparison_matrix,
        ranking: result.ranking,
        trade_offs: result.trade_offs,
        recommendation: generateRecommendation(result),
      },
      metadata: {
        calculation_method: 'Multi-scenario comparison with KPI delta analysis',
        data_sources: ['wms_inventory_ledger', 'wms_orders', 'master_location', 'master_employee'],
        scenarios_compared: scenarios.length,
        generated_at: result.timestamp,
      },
      disclaimer: SIMULATION_DISCLAIMER,
    });

  } catch (error) {
    console.error('[Simulation API] Compare error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Comparison failed',
      },
      { status: 500 }
    );
  }
}

function generateRecommendation(result: any): string {
  const { ranking, trade_offs, scenarios } = result;
  
  if (scenarios.length === 0) {
    return 'ไม่มี scenario ให้เปรียบเทียบ';
  }

  const bestByCapacity = scenarios.find((s: any) => s.scenario.id === ranking.by_capacity[0]);
  const bestByRisk = scenarios.find((s: any) => s.scenario.id === ranking.by_risk[0]);

  let recommendation = '';

  if (ranking.by_capacity[0] === ranking.by_risk[0]) {
    recommendation = `แนะนำ: ${bestByCapacity?.scenario.name} - ดีที่สุดทั้งด้านความจุและความเสี่ยง`;
  } else {
    recommendation = `ต้องพิจารณา trade-off:\n`;
    recommendation += `- ความจุสูงสุด: ${bestByCapacity?.scenario.name}\n`;
    recommendation += `- ความเสี่ยงต่ำสุด: ${bestByRisk?.scenario.name}`;
  }

  if (trade_offs.length > 0) {
    recommendation += `\n\nข้อควรพิจารณา:\n${trade_offs.map((t: string) => `- ${t}`).join('\n')}`;
  }

  return recommendation;
}

async function _GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/ai/simulation/compare',
    method: 'POST',
    description: 'Compare multiple scenarios side by side',
    parameters: {
      scenarios: {
        type: 'array',
        required: true,
        description: 'Array of scenarios to compare (max 5)',
        items: {
          type: {
            type: 'string',
            enum: ['demand_increase', 'lead_time_increase', 'storage_reduction', 'shift_change'],
          },
          name: {
            type: 'string',
            required: false,
          },
          parameters: {
            type: 'object',
            description: 'Parameters specific to the scenario type',
          },
        },
      },
    },
    example: {
      scenarios: [
        {
          type: 'demand_increase',
          name: 'Peak Season',
          parameters: { demand_multiplier: 1.5 },
        },
        {
          type: 'storage_reduction',
          name: 'Space Constraint',
          parameters: { reduction_percent: 20 },
        },
      ],
    },
  });
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);

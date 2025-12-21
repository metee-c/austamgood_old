/**
 * Scenario Engine for Digital Twin
 * 
 * Runs what-if simulations and calculates impacts
 * 
 * Properties validated:
 * - Property 5: Demand Multiplier Application
 * - Property 6: Lead Time Addition
 * - Property 7: Storage Reduction Calculation
 * - Property 9: KPI Delta Calculation
 * - Property 11: Bottleneck Identification
 * - Property 12: Risk Score Bounds
 */

import {
  WarehouseState,
  SimulationResult,
  ComparisonResult,
  Scenario,
  ScenarioType,
  DemandScenarioParams,
  LeadTimeScenarioParams,
  StorageScenarioParams,
  ShiftScenarioParams,
  KPIDelta,
  Bottleneck,
  Risk,
  calculateKPIDeltaValue,
  getRiskLevel,
  getBottleneckSeverity,
  generateSimulationId,
  SIMULATION_DISCLAIMER,
} from './types';
import { DigitalTwin, getDigitalTwin } from './digital-twin';
import { applyCapacityChange, calculateOverflowAnalysis } from './models/storage-model';
import { applyDemandMultiplier, identifyThroughputBottlenecks } from './models/throughput-model';
import { applyWorkforceChange, calculateLaborGap } from './models/labor-model';
import { applyLeadTimeIncrease } from './models/leadtime-model';
import { applyDemandMultiplier as applyOrderDemandMultiplier } from './models/order-pattern-model';

/**
 * Scenario Engine class
 */
export class ScenarioEngine {
  private digitalTwin: DigitalTwin;

  constructor(digitalTwin: DigitalTwin) {
    this.digitalTwin = digitalTwin;
  }

  /**
   * Run demand increase scenario
   * Property 5: Demand Multiplier Application
   */
  runDemandIncrease(params: DemandScenarioParams): SimulationResult {
    const { demand_multiplier } = params;
    
    if (demand_multiplier <= 0) {
      throw new Error('demand_multiplier must be positive');
    }

    const baseline = this.digitalTwin.getBaseline();
    
    // Apply demand multiplier to throughput and order patterns
    const simulatedThroughput = applyDemandMultiplier(baseline.throughput, demand_multiplier);
    const simulatedOrderPatterns = applyOrderDemandMultiplier(baseline.orderPatterns, demand_multiplier);

    // Create simulated state
    const simulated: WarehouseState = {
      ...baseline,
      throughput: simulatedThroughput,
      orderPatterns: simulatedOrderPatterns,
      timestamp: new Date().toISOString(),
      data_snapshot_id: `${baseline.data_snapshot_id}_demand`,
    };

    // Calculate KPI delta
    const kpiDelta = this.calculateKPIDelta(baseline, simulated);

    // Identify bottlenecks
    const bottlenecks = this.analyzeBottlenecks(baseline, simulated);

    // Assess risks
    const risks = this.assessRisks(simulated, 'demand_increase');

    return {
      scenario_id: generateSimulationId(),
      scenario_type: 'demand_increase',
      scenario_name: `Demand Increase ${Math.round((demand_multiplier - 1) * 100)}%`,
      parameters: params,
      baseline,
      simulated,
      kpi_delta: kpiDelta,
      bottlenecks,
      risks,
      timestamp: new Date().toISOString(),
      calculation_method: 'Historical average * demand_multiplier',
      confidence_level: baseline.throughput.outbound.data_points >= 30 ? 'high' : 'medium',
      disclaimer: SIMULATION_DISCLAIMER,
    };
  }

  /**
   * Run lead time increase scenario
   * Property 6: Lead Time Addition
   */
  runLeadTimeIncrease(params: LeadTimeScenarioParams): SimulationResult {
    const { lead_time_increase_days, supplier_ids } = params;
    
    if (lead_time_increase_days < 0) {
      throw new Error('lead_time_increase_days cannot be negative');
    }

    const baseline = this.digitalTwin.getBaseline();
    
    // Apply lead time increase
    const simulatedLeadTime = applyLeadTimeIncrease(
      baseline.leadTime,
      lead_time_increase_days,
      supplier_ids
    );

    // Create simulated state
    const simulated: WarehouseState = {
      ...baseline,
      leadTime: simulatedLeadTime,
      timestamp: new Date().toISOString(),
      data_snapshot_id: `${baseline.data_snapshot_id}_leadtime`,
    };

    // Calculate KPI delta
    const kpiDelta = this.calculateKPIDelta(baseline, simulated);

    // Identify bottlenecks (lead time affects stockout risk)
    const bottlenecks: Bottleneck[] = [];

    // Assess risks
    const risks = this.assessRisks(simulated, 'lead_time_increase');

    return {
      scenario_id: generateSimulationId(),
      scenario_type: 'lead_time_increase',
      scenario_name: `Lead Time +${lead_time_increase_days} days`,
      parameters: params,
      baseline,
      simulated,
      kpi_delta: kpiDelta,
      bottlenecks,
      risks,
      timestamp: new Date().toISOString(),
      calculation_method: 'Baseline lead_time + increase_days',
      confidence_level: baseline.leadTime.suppliers.length >= 5 ? 'high' : 'medium',
      disclaimer: SIMULATION_DISCLAIMER,
    };
  }

  /**
   * Run storage reduction scenario
   * Property 7: Storage Reduction Calculation
   */
  runStorageReduction(params: StorageScenarioParams): SimulationResult {
    const { reduction_percent, reduction_locations, affected_zones } = params;
    
    if (reduction_percent !== undefined && (reduction_percent < 0 || reduction_percent > 100)) {
      throw new Error('reduction_percent must be between 0 and 100');
    }

    const baseline = this.digitalTwin.getBaseline();
    
    // Apply storage reduction
    let simulatedStorage = baseline.storage;
    
    if (reduction_percent !== undefined) {
      simulatedStorage = applyCapacityChange(baseline.storage, {
        type: 'reduction_percent',
        reduction_percent,
        affected_zones,
      });
    } else if (reduction_locations && reduction_locations.length > 0) {
      simulatedStorage = applyCapacityChange(baseline.storage, {
        type: 'reduction_locations',
        reduction_locations,
      });
    }

    // Create simulated state
    const simulated: WarehouseState = {
      ...baseline,
      storage: simulatedStorage,
      timestamp: new Date().toISOString(),
      data_snapshot_id: `${baseline.data_snapshot_id}_storage`,
    };

    // Calculate KPI delta
    const kpiDelta = this.calculateKPIDelta(baseline, simulated);

    // Identify bottlenecks
    const bottlenecks = this.analyzeBottlenecks(baseline, simulated);

    // Assess risks
    const risks = this.assessRisks(simulated, 'storage_reduction');

    return {
      scenario_id: generateSimulationId(),
      scenario_type: 'storage_reduction',
      scenario_name: reduction_percent 
        ? `Storage Reduction ${reduction_percent}%`
        : `Remove ${reduction_locations?.length || 0} locations`,
      parameters: params,
      baseline,
      simulated,
      kpi_delta: kpiDelta,
      bottlenecks,
      risks,
      timestamp: new Date().toISOString(),
      calculation_method: 'Baseline capacity * (1 - reduction_percent/100)',
      confidence_level: 'high',
      disclaimer: SIMULATION_DISCLAIMER,
    };
  }

  /**
   * Run shift change scenario
   * Property 8: Labor Capacity Calculation
   */
  runShiftChange(params: ShiftScenarioParams): SimulationResult {
    const baseline = this.digitalTwin.getBaseline();
    
    // Apply workforce change
    const simulatedLabor = applyWorkforceChange(baseline.labor, params);

    // Create simulated state
    const simulated: WarehouseState = {
      ...baseline,
      labor: simulatedLabor,
      timestamp: new Date().toISOString(),
      data_snapshot_id: `${baseline.data_snapshot_id}_shift`,
    };

    // Calculate KPI delta
    const kpiDelta = this.calculateKPIDelta(baseline, simulated);

    // Identify bottlenecks
    const bottlenecks = this.analyzeBottlenecks(baseline, simulated);

    // Assess risks
    const risks = this.assessRisks(simulated, 'shift_change');

    // Build scenario name
    const changes: string[] = [];
    if (params.shift_hours_change) changes.push(`Hours ${params.shift_hours_change > 0 ? '+' : ''}${params.shift_hours_change}`);
    if (params.worker_count_change) changes.push(`Workers ${params.worker_count_change > 0 ? '+' : ''}${params.worker_count_change}%`);
    if (params.productivity_change_percent) changes.push(`Productivity ${params.productivity_change_percent > 0 ? '+' : ''}${params.productivity_change_percent}%`);

    return {
      scenario_id: generateSimulationId(),
      scenario_type: 'shift_change',
      scenario_name: `Shift Change: ${changes.join(', ') || 'No change'}`,
      parameters: params,
      baseline,
      simulated,
      kpi_delta: kpiDelta,
      bottlenecks,
      risks,
      timestamp: new Date().toISOString(),
      calculation_method: 'workers * hours_per_shift * productivity_rate',
      confidence_level: baseline.labor.productivity.confidence,
      disclaimer: SIMULATION_DISCLAIMER,
    };
  }

  /**
   * Calculate KPI delta between baseline and simulated state
   * Property 9: KPI Delta Calculation
   */
  calculateKPIDelta(baseline: WarehouseState, simulated: WarehouseState): KPIDelta {
    // Throughput delta (outbound qty)
    const throughputDelta = calculateKPIDeltaValue(
      baseline.throughput.outbound.avg_daily_qty,
      simulated.throughput.outbound.avg_daily_qty
    );

    // Utilization delta (storage)
    const utilizationDelta = calculateKPIDeltaValue(
      baseline.storage.summary.utilization_percent,
      simulated.storage.summary.utilization_percent
    );

    // Labor utilization delta
    const baselineLaborUtil = this.calculateLaborUtilization(baseline);
    const simulatedLaborUtil = this.calculateLaborUtilization(simulated);
    const laborDelta = calculateKPIDeltaValue(baselineLaborUtil, simulatedLaborUtil);

    // Stockout risk delta (simplified)
    const baselineRisk = this.calculateStockoutRiskScore(baseline);
    const simulatedRisk = this.calculateStockoutRiskScore(simulated);
    const riskDelta = calculateKPIDeltaValue(baselineRisk, simulatedRisk);

    return {
      throughput: {
        baseline: baseline.throughput.outbound.avg_daily_qty,
        simulated: simulated.throughput.outbound.avg_daily_qty,
        ...throughputDelta,
      },
      utilization: {
        baseline: baseline.storage.summary.utilization_percent,
        simulated: simulated.storage.summary.utilization_percent,
        ...utilizationDelta,
      },
      labor_utilization: {
        baseline: baselineLaborUtil,
        simulated: simulatedLaborUtil,
        ...laborDelta,
      },
      stockout_risk: {
        baseline: baselineRisk,
        simulated: simulatedRisk,
        ...riskDelta,
      },
    };
  }

  /**
   * Analyze bottlenecks
   * Property 11: Bottleneck Identification
   */
  analyzeBottlenecks(baseline: WarehouseState, simulated: WarehouseState): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Storage bottleneck
    if (simulated.storage.summary.utilization_percent > 80) {
      const severity = getBottleneckSeverity(simulated.storage.summary.utilization_percent);
      bottlenecks.push({
        resource_type: 'storage',
        resource_id: 'warehouse_storage',
        resource_name: 'พื้นที่จัดเก็บ',
        current_utilization: simulated.storage.summary.utilization_percent,
        max_capacity: simulated.storage.summary.total_capacity,
        severity,
        throughput_impact: Math.max(0, simulated.storage.summary.utilization_percent - 100),
        resolution_options: [
          'เพิ่มพื้นที่จัดเก็บ',
          'ปรับปรุงการจัดวางสินค้า',
          'ลดสต็อกสินค้าที่ไม่จำเป็น',
        ],
      });
    }

    // Labor bottleneck
    const laborUtil = this.calculateLaborUtilization(simulated);
    if (laborUtil > 80) {
      const severity = getBottleneckSeverity(laborUtil);
      bottlenecks.push({
        resource_type: 'labor',
        resource_id: 'workforce',
        resource_name: 'กำลังคน',
        current_utilization: laborUtil,
        max_capacity: simulated.labor.capacity.picking_capacity_qty,
        severity,
        throughput_impact: Math.max(0, laborUtil - 100),
        resolution_options: [
          'เพิ่มพนักงาน',
          'เพิ่มชั่วโมงทำงาน',
          'ปรับปรุงประสิทธิภาพการทำงาน',
        ],
      });
    }

    // Throughput bottleneck
    const throughputBottlenecks = identifyThroughputBottlenecks(baseline.throughput, simulated.throughput);
    throughputBottlenecks.forEach((tb) => {
      bottlenecks.push({
        resource_type: 'process',
        resource_id: tb.type,
        resource_name: tb.type === 'outbound' ? 'กระบวนการจัดส่ง' : 'กระบวนการรับสินค้า',
        current_utilization: 100,
        max_capacity: tb.type === 'outbound' 
          ? baseline.throughput.historical_peak.outbound_peak_qty
          : baseline.throughput.historical_peak.inbound_peak_qty,
        severity: tb.severity,
        throughput_impact: 0,
        resolution_options: [
          'เพิ่มกำลังคน',
          'ปรับปรุงกระบวนการ',
          'เพิ่มอุปกรณ์',
        ],
      });
    });

    // Sort by severity (critical first)
    // Property 11: primary_bottleneck = highest utilization
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return bottlenecks;
  }

  /**
   * Assess risks for simulated state
   * Property 12: Risk Score Bounds (0-100)
   */
  assessRisks(simulated: WarehouseState, scenarioType: ScenarioType): Risk[] {
    const risks: Risk[] = [];

    // Overflow risk
    if (simulated.storage.summary.overflow_locations > 0) {
      const overflowAnalysis = calculateOverflowAnalysis(simulated.storage);
      const score = Math.min(100, Math.max(0, 
        (overflowAnalysis.total_overflow_qty / simulated.storage.summary.total_capacity) * 200
      ));
      
      risks.push({
        risk_type: 'overflow',
        risk_score: Math.round(score),
        risk_level: getRiskLevel(score),
        affected_items: overflowAnalysis.overflow_locations.map(l => l.location_code),
        contributing_factors: [
          `${overflowAnalysis.overflow_locations.length} โลเคชั่นเกินความจุ`,
          `สินค้าล้น ${overflowAnalysis.total_overflow_qty.toLocaleString()} ชิ้น`,
        ],
        mitigation_options: [
          'เพิ่มพื้นที่จัดเก็บ',
          'โอนย้ายสินค้าไปคลังอื่น',
          'ลดการสั่งซื้อชั่วคราว',
        ],
      });
    }

    // Service level risk (based on labor capacity)
    const laborUtil = this.calculateLaborUtilization(simulated);
    if (laborUtil > 90) {
      const score = Math.min(100, Math.max(0, (laborUtil - 90) * 10));
      
      risks.push({
        risk_type: 'service_level',
        risk_score: Math.round(score),
        risk_level: getRiskLevel(score),
        affected_items: [],
        contributing_factors: [
          `กำลังคนใช้งาน ${laborUtil.toFixed(1)}%`,
          'อาจไม่สามารถจัดส่งได้ทันเวลา',
        ],
        mitigation_options: [
          'เพิ่มพนักงานชั่วคราว',
          'เพิ่มชั่วโมงทำงานล่วงเวลา',
          'จัดลำดับความสำคัญออเดอร์',
        ],
      });
    }

    // Stockout risk (for lead time scenarios)
    if (scenarioType === 'lead_time_increase') {
      const avgLeadTime = simulated.leadTime.overall.avg_lead_time;
      const score = Math.min(100, Math.max(0, avgLeadTime * 5)); // Simplified
      
      if (score > 30) {
        risks.push({
          risk_type: 'stockout',
          risk_score: Math.round(score),
          risk_level: getRiskLevel(score),
          affected_items: simulated.leadTime.high_variability_suppliers,
          contributing_factors: [
            `Lead time เฉลี่ย ${avgLeadTime} วัน`,
            `${simulated.leadTime.high_variability_suppliers.length} ซัพพลายเออร์มีความผันผวนสูง`,
          ],
          mitigation_options: [
            'เพิ่ม Safety Stock',
            'หาซัพพลายเออร์สำรอง',
            'สั่งซื้อล่วงหน้ามากขึ้น',
          ],
        });
      }
    }

    return risks;
  }

  /**
   * Compare multiple scenarios
   */
  compareScenarios(scenarios: Scenario[]): ComparisonResult {
    const baseline = this.digitalTwin.getBaseline();
    const results: { scenario: Scenario; result: SimulationResult }[] = [];

    // Run each scenario
    scenarios.forEach((scenario) => {
      let result: SimulationResult;
      
      switch (scenario.type) {
        case 'demand_increase':
          result = this.runDemandIncrease(scenario.parameters as DemandScenarioParams);
          break;
        case 'lead_time_increase':
          result = this.runLeadTimeIncrease(scenario.parameters as LeadTimeScenarioParams);
          break;
        case 'storage_reduction':
          result = this.runStorageReduction(scenario.parameters as StorageScenarioParams);
          break;
        case 'shift_change':
          result = this.runShiftChange(scenario.parameters as ShiftScenarioParams);
          break;
        default:
          throw new Error(`Unknown scenario type: ${scenario.type}`);
      }

      results.push({ scenario, result });
    });

    // Build comparison matrix
    const metrics = ['throughput', 'utilization', 'labor_utilization', 'stockout_risk'];
    const comparisonMatrix = metrics.map((metric) => {
      const baselineValue = this.getMetricValue(baseline, metric);
      const scenarioValues: Record<string, number> = {};
      
      results.forEach(({ scenario, result }) => {
        scenarioValues[scenario.id] = this.getMetricValue(result.simulated, metric);
      });

      const values = Object.entries(scenarioValues);
      const best = values.reduce((a, b) => 
        metric === 'stockout_risk' 
          ? (a[1] < b[1] ? a : b)  // Lower is better for risk
          : (a[1] > b[1] ? a : b)  // Higher is better for others
      );
      const worst = values.reduce((a, b) => 
        metric === 'stockout_risk'
          ? (a[1] > b[1] ? a : b)
          : (a[1] < b[1] ? a : b)
      );

      return {
        metric,
        baseline_value: baselineValue,
        scenario_values: scenarioValues,
        best_scenario: best[0],
        worst_scenario: worst[0],
      };
    });

    // Rank scenarios
    const ranking = {
      by_cost: results
        .sort((a, b) => a.result.kpi_delta.labor_utilization.simulated - b.result.kpi_delta.labor_utilization.simulated)
        .map(r => r.scenario.id),
      by_risk: results
        .sort((a, b) => a.result.kpi_delta.stockout_risk.simulated - b.result.kpi_delta.stockout_risk.simulated)
        .map(r => r.scenario.id),
      by_capacity: results
        .sort((a, b) => b.result.kpi_delta.throughput.simulated - a.result.kpi_delta.throughput.simulated)
        .map(r => r.scenario.id),
    };

    // Identify trade-offs
    const tradeOffs: string[] = [];
    if (ranking.by_cost[0] !== ranking.by_capacity[0]) {
      tradeOffs.push('ต้นทุนต่ำสุดไม่ใช่ความจุสูงสุด - ต้องเลือกระหว่างประหยัดต้นทุนหรือเพิ่มความจุ');
    }
    if (ranking.by_risk[0] !== ranking.by_capacity[0]) {
      tradeOffs.push('ความเสี่ยงต่ำสุดไม่ใช่ความจุสูงสุด - ต้องเลือกระหว่างลดความเสี่ยงหรือเพิ่มความจุ');
    }

    return {
      baseline,
      scenarios: results,
      comparison_matrix: comparisonMatrix,
      ranking,
      trade_offs: tradeOffs,
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods
  private calculateLaborUtilization(state: WarehouseState): number {
    const demand = state.throughput.outbound.avg_daily_qty;
    const capacity = state.labor.capacity.picking_capacity_qty;
    return capacity > 0 ? (demand / capacity) * 100 : 0;
  }

  private calculateStockoutRiskScore(state: WarehouseState): number {
    // Simplified: based on lead time and utilization
    const leadTimeFactor = state.leadTime.overall.avg_lead_time / 30; // Normalize to 30 days
    const utilizationFactor = state.storage.summary.utilization_percent / 100;
    return Math.min(100, Math.max(0, (leadTimeFactor + utilizationFactor) * 50));
  }

  private getMetricValue(state: WarehouseState, metric: string): number {
    switch (metric) {
      case 'throughput':
        return state.throughput.outbound.avg_daily_qty;
      case 'utilization':
        return state.storage.summary.utilization_percent;
      case 'labor_utilization':
        return this.calculateLaborUtilization(state);
      case 'stockout_risk':
        return this.calculateStockoutRiskScore(state);
      default:
        return 0;
    }
  }
}

/**
 * Create scenario engine with initialized digital twin
 */
export async function createScenarioEngine(): Promise<ScenarioEngine> {
  const digitalTwin = await getDigitalTwin();
  return new ScenarioEngine(digitalTwin);
}

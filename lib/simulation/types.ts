/**
 * Digital Twin & What-If Scenario Engine Types
 * 
 * หลักการ:
 * - Deterministic: ผลลัพธ์เดียวกันทุกครั้งจาก parameters เดียวกัน
 * - Isolated: การจำลองไม่กระทบข้อมูลจริง
 * - Historical-based: ใช้ข้อมูลประวัติจริง ไม่ใช่ AI prediction
 * - Explainable: ทุกการคำนวณอธิบายได้
 */

// ============================================
// Base Types
// ============================================

export interface SimulationMetadata {
  simulation_id: string;
  scenario_type: string;
  parameters: Record<string, any>;
  data_snapshot_timestamp: string;
  calculation_method: string;
  data_sources: string[];
  data_period: string;
  data_points: number;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_percent: number;
  generated_at: string;
}

export interface SimulationResponse<T = any> {
  success: boolean;
  data: T;
  metadata: SimulationMetadata;
  disclaimer: string;
  error?: string;
}

// ============================================
// Storage Model Types
// ============================================

export interface LocationCapacity {
  location_id: string;
  location_code: string;
  zone: string;
  warehouse_id: string;
  warehouse_name: string;
  max_capacity: number;
  current_qty: number;
  utilization_percent: number;
  is_overflow: boolean;
  overflow_qty: number;
}

export interface ZoneCapacity {
  zone: string;
  warehouse_id: string;
  warehouse_name: string;
  total_locations: number;
  total_capacity: number;
  current_qty: number;
  utilization_percent: number;
  is_overflow: boolean;
  overflow_qty: number;
}

export interface WarehouseCapacity {
  warehouse_id: string;
  warehouse_name: string;
  total_locations: number;
  total_capacity: number;
  current_qty: number;
  available_capacity: number;
  utilization_percent: number;
  is_overflow: boolean;
  overflow_qty: number;
  zones: ZoneCapacity[];
}

export interface StorageModel {
  locations: LocationCapacity[];
  zones: ZoneCapacity[];
  warehouses: WarehouseCapacity[];
  summary: {
    total_locations: number;
    total_capacity: number;
    current_qty: number;
    available_capacity: number;
    utilization_percent: number;
    overflow_locations: number;
    total_overflow_qty: number;
  };
}

export interface UtilizationMetrics {
  total_capacity: number;
  used_capacity: number;
  available_capacity: number;
  utilization_percent: number;
  overflow_qty: number;
  by_zone: Record<string, { capacity: number; used: number; utilization: number }>;
  by_warehouse: Record<string, { capacity: number; used: number; utilization: number }>;
}

export interface CapacityChange {
  type: 'reduction_percent' | 'reduction_locations' | 'add_capacity';
  reduction_percent?: number;
  reduction_locations?: string[];
  affected_zones?: string[];
  add_capacity_qty?: number;
}

export interface OverflowAnalysis {
  has_overflow: boolean;
  total_overflow_qty: number;
  overflow_locations: {
    location_id: string;
    location_code: string;
    overflow_qty: number;
    utilization_percent: number;
  }[];
  affected_zones: string[];
}

// ============================================
// Throughput Model Types
// ============================================

export interface InboundMetrics {
  avg_daily_qty: number;
  avg_daily_orders: number;
  avg_daily_pallets: number;
  peak_daily_qty: number;
  peak_daily_orders: number;
  peak_date: string;
  total_qty: number;
  total_orders: number;
  data_points: number;
}

export interface OutboundMetrics {
  avg_daily_qty: number;
  avg_daily_orders: number;
  avg_daily_picks: number;
  peak_daily_qty: number;
  peak_daily_orders: number;
  peak_date: string;
  total_qty: number;
  total_orders: number;
  data_points: number;
}

export interface PeakMetrics {
  inbound_peak_qty: number;
  inbound_peak_date: string;
  outbound_peak_qty: number;
  outbound_peak_date: string;
}

export interface ThroughputModel {
  inbound: InboundMetrics;
  outbound: OutboundMetrics;
  historical_peak: PeakMetrics;
  period_days: number;
  data_from: string;
  data_to: string;
}

// ============================================
// Labor Model Types
// ============================================

export interface HeadcountByRole {
  total: number;
  pickers: number;
  receivers: number;
  loaders: number;
  other: number;
}

export interface ProductivityRates {
  picks_per_hour_per_picker: number;
  receives_per_hour_per_receiver: number;
  loads_per_hour_per_loader: number;
  data_points: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface DailyCapacity {
  picking_capacity_qty: number;
  receiving_capacity_qty: number;
  loading_capacity_qty: number;
  hours_per_shift: number;
}

export interface LaborModel {
  headcount: HeadcountByRole;
  productivity: ProductivityRates;
  capacity: DailyCapacity;
  utilization: {
    picking_utilization: number;
    receiving_utilization: number;
    loading_utilization: number;
    overall_utilization: number;
  };
}

export interface WorkforceChange {
  shift_hours_change?: number;
  worker_count_change?: number;
  productivity_change_percent?: number;
  role?: 'pickers' | 'receivers' | 'loaders' | 'all';
}

// ============================================
// Lead Time Model Types
// ============================================

export interface SupplierLeadTime {
  supplier_id: string;
  supplier_name: string;
  avg_lead_time: number;
  p50_lead_time: number;
  p90_lead_time: number;
  min_lead_time: number;
  max_lead_time: number;
  std_deviation: number;
  variability_score: 'low' | 'medium' | 'high';
  data_points: number;
}

export interface LeadTimeModel {
  suppliers: SupplierLeadTime[];
  overall: {
    avg_lead_time: number;
    p50_lead_time: number;
    p90_lead_time: number;
    std_deviation: number;
  };
  high_variability_suppliers: string[];
}

// ============================================
// Order Pattern Model Types
// ============================================

export interface DailyPattern {
  day_of_week: number; // 0=Sunday, 6=Saturday
  day_name: string;
  avg_orders: number;
  avg_qty: number;
  relative_volume: number; // 1.0 = average
}

export interface MonthlySeasonality {
  month: number; // 1-12
  month_name: string;
  avg_orders: number;
  avg_qty: number;
  seasonality_factor: number; // 1.0 = average
}

export interface OrderPatternModel {
  daily_avg_orders: number;
  daily_avg_qty: number;
  weekly_pattern: DailyPattern[];
  monthly_seasonality: MonthlySeasonality[];
  peak_day_of_week: string;
  peak_month: string;
  data_period_days: number;
}

// ============================================
// Warehouse State (Digital Twin)
// ============================================

export interface WarehouseState {
  storage: StorageModel;
  throughput: ThroughputModel;
  labor: LaborModel;
  leadTime: LeadTimeModel;
  orderPatterns: OrderPatternModel;
  timestamp: string;
  data_snapshot_id: string;
}

// ============================================
// Scenario Types
// ============================================

export type ScenarioType = 
  | 'demand_increase'
  | 'lead_time_increase'
  | 'storage_reduction'
  | 'shift_change';

export interface DemandScenarioParams {
  demand_multiplier: number; // e.g., 1.2 for 20% increase
  period_days?: number;
}

export interface LeadTimeScenarioParams {
  lead_time_increase_days: number;
  supplier_ids?: string[]; // specific suppliers, or all if empty
}

export interface StorageScenarioParams {
  reduction_percent?: number;
  reduction_locations?: string[];
  affected_zones?: string[];
}

export interface ShiftScenarioParams {
  shift_hours_change?: number;
  worker_count_change?: number;
  productivity_change_percent?: number;
}

export type ScenarioParams = 
  | DemandScenarioParams 
  | LeadTimeScenarioParams 
  | StorageScenarioParams 
  | ShiftScenarioParams;

export interface Scenario {
  id: string;
  type: ScenarioType;
  name: string;
  description: string;
  parameters: ScenarioParams;
  created_at: string;
}

// ============================================
// Analysis Results
// ============================================

export interface KPIDelta {
  throughput: {
    baseline: number;
    simulated: number;
    absolute_delta: number;
    percent_delta: number;
  };
  utilization: {
    baseline: number;
    simulated: number;
    absolute_delta: number;
    percent_delta: number;
  };
  labor_utilization: {
    baseline: number;
    simulated: number;
    absolute_delta: number;
    percent_delta: number;
  };
  stockout_risk: {
    baseline: number;
    simulated: number;
    absolute_delta: number;
    percent_delta: number;
  };
}

export interface Bottleneck {
  resource_type: 'storage' | 'labor' | 'equipment' | 'process';
  resource_id: string;
  resource_name: string;
  current_utilization: number;
  max_capacity: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  throughput_impact: number;
  resolution_options: string[];
}

export interface Risk {
  risk_type: 'stockout' | 'overflow' | 'service_level' | 'expiry';
  risk_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  affected_items: string[];
  contributing_factors: string[];
  mitigation_options: string[];
}

export interface SimulationResult {
  scenario_id: string;
  scenario_type: ScenarioType;
  scenario_name: string;
  parameters: Record<string, any>;
  baseline: WarehouseState;
  simulated: WarehouseState;
  kpi_delta: KPIDelta;
  bottlenecks: Bottleneck[];
  risks: Risk[];
  timestamp: string;
  calculation_method: string;
  confidence_level: 'high' | 'medium' | 'low';
  disclaimer: string;
}

export interface ComparisonResult {
  baseline: WarehouseState;
  scenarios: {
    scenario: Scenario;
    result: SimulationResult;
  }[];
  comparison_matrix: {
    metric: string;
    baseline_value: number;
    scenario_values: Record<string, number>;
    best_scenario: string;
    worst_scenario: string;
  }[];
  ranking: {
    by_cost: string[];
    by_risk: string[];
    by_capacity: string[];
  };
  trade_offs: string[];
  timestamp: string;
}

// ============================================
// Scenario Templates
// ============================================

export interface ScenarioTemplate {
  id: string;
  name: string;
  name_th: string;
  description: string;
  description_th: string;
  scenario_type: ScenarioType;
  default_parameters: ScenarioParams;
  typical_use_case: string;
  typical_use_case_th: string;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'peak_season',
    name: 'Peak Season',
    name_th: 'ช่วงพีค',
    description: 'Simulate 50% demand increase for peak season planning',
    description_th: 'จำลองความต้องการเพิ่ม 50% สำหรับวางแผนช่วงพีค',
    scenario_type: 'demand_increase',
    default_parameters: { demand_multiplier: 1.5 } as DemandScenarioParams,
    typical_use_case: 'Planning for holiday seasons, promotions, or high-demand periods',
    typical_use_case_th: 'วางแผนสำหรับช่วงเทศกาล โปรโมชั่น หรือช่วงที่มีความต้องการสูง',
  },
  {
    id: 'supplier_delay',
    name: 'Supplier Delay',
    name_th: 'ซัพพลายเออร์ล่าช้า',
    description: 'Simulate 7-day increase in supplier lead times',
    description_th: 'จำลองซัพพลายเออร์ส่งช้าขึ้น 7 วัน',
    scenario_type: 'lead_time_increase',
    default_parameters: { lead_time_increase_days: 7 } as LeadTimeScenarioParams,
    typical_use_case: 'Assessing inventory risk when suppliers face delays',
    typical_use_case_th: 'ประเมินความเสี่ยงสต็อกเมื่อซัพพลายเออร์มีปัญหาการส่ง',
  },
  {
    id: 'space_constraint',
    name: 'Space Constraint',
    name_th: 'พื้นที่จำกัด',
    description: 'Simulate 20% reduction in storage capacity',
    description_th: 'จำลองพื้นที่จัดเก็บลดลง 20%',
    scenario_type: 'storage_reduction',
    default_parameters: { reduction_percent: 20 } as StorageScenarioParams,
    typical_use_case: 'Planning for warehouse renovation or space reallocation',
    typical_use_case_th: 'วางแผนสำหรับการปรับปรุงคลังหรือจัดสรรพื้นที่ใหม่',
  },
  {
    id: 'reduced_workforce',
    name: 'Reduced Workforce',
    name_th: 'ลดกำลังคน',
    description: 'Simulate 25% reduction in workforce',
    description_th: 'จำลองกำลังคนลดลง 25%',
    scenario_type: 'shift_change',
    default_parameters: { worker_count_change: -25 } as ShiftScenarioParams,
    typical_use_case: 'Planning for staff shortages or cost reduction',
    typical_use_case_th: 'วางแผนสำหรับการขาดแคลนพนักงานหรือลดต้นทุน',
  },
  {
    id: 'growth_planning',
    name: 'Growth Planning',
    name_th: 'วางแผนการเติบโต',
    description: 'Simulate 100% demand increase for growth planning',
    description_th: 'จำลองความต้องการเพิ่ม 100% สำหรับวางแผนการเติบโต',
    scenario_type: 'demand_increase',
    default_parameters: { demand_multiplier: 2.0 } as DemandScenarioParams,
    typical_use_case: 'Long-term capacity planning for business growth',
    typical_use_case_th: 'วางแผนความจุระยะยาวสำหรับการเติบโตของธุรกิจ',
  },
];

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate utilization percentage
 * Property 1: Utilization Calculation Correctness
 */
export function calculateUtilization(current: number, max: number): number {
  if (max <= 0) return 0;
  return (current / max) * 100;
}

/**
 * Calculate overflow quantity
 * Property 4: Overflow Detection
 */
export function calculateOverflow(current: number, max: number): { isOverflow: boolean; overflowQty: number } {
  if (current <= max) {
    return { isOverflow: false, overflowQty: 0 };
  }
  return { isOverflow: true, overflowQty: current - max };
}

/**
 * Calculate KPI delta
 * Property 9: KPI Delta Calculation
 */
export function calculateKPIDeltaValue(
  baseline: number,
  simulated: number
): { absolute_delta: number; percent_delta: number } {
  const absolute_delta = simulated - baseline;
  const percent_delta = baseline !== 0 ? (absolute_delta / baseline) * 100 : 0;
  return { absolute_delta, percent_delta };
}

/**
 * Determine risk level from score
 * Property 12: Risk Score Bounds
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));
  
  if (clampedScore <= 30) return 'low';
  if (clampedScore <= 60) return 'medium';
  if (clampedScore <= 80) return 'high';
  return 'critical';
}

/**
 * Determine bottleneck severity from utilization
 */
export function getBottleneckSeverity(utilization: number): 'low' | 'medium' | 'high' | 'critical' {
  if (utilization < 70) return 'low';
  if (utilization < 85) return 'medium';
  if (utilization < 95) return 'high';
  return 'critical';
}

/**
 * Generate unique simulation ID
 */
export function generateSimulationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sim_${timestamp}_${random}`;
}

/**
 * Standard disclaimer for all simulations
 */
export const SIMULATION_DISCLAIMER = 
  'ผลลัพธ์นี้เป็นการจำลองจากข้อมูลประวัติ ไม่ใช่การพยากรณ์ ควรใช้เป็นข้อมูลประกอบการตัดสินใจเท่านั้น';

export const SIMULATION_DISCLAIMER_EN = 
  'These results are simulations based on historical data, not predictions. Use as reference only.';

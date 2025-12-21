# Design Document: Warehouse Digital Twin & What-If Scenario Engine

## Overview

ระบบ Digital Twin สร้างโมเดลเสมือนของคลังสินค้าที่สะท้อนสถานะและพฤติกรรมจริง เพื่อให้ผู้ใช้สามารถจำลองสถานการณ์ต่างๆ (What-If Analysis) โดยไม่กระทบข้อมูลจริง

**หลักการออกแบบ:**
- **Deterministic**: ผลลัพธ์เดียวกันทุกครั้งจาก parameters เดียวกัน
- **Isolated**: การจำลองไม่กระทบข้อมูลจริง (in-memory calculations)
- **Historical-based**: ใช้ข้อมูลประวัติจริง ไม่ใช่ AI prediction
- **Explainable**: ทุกการคำนวณอธิบายได้

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Chat Interface                       │
│                  (Intent Detection & Response)               │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Simulation API Layer                      │
│              /api/ai/simulation/[scenario-type]              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                   Digital Twin Engine                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Storage   │ │  Throughput │ │    Labor    │            │
│  │    Model    │ │    Model    │ │    Model    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │  Lead Time  │ │   Order     │ │  Scenario   │            │
│  │    Model    │ │  Patterns   │ │   Engine    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Data Snapshot Layer                       │
│         (Read-only access to current database state)         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Digital Twin Engine (`lib/simulation/digital-twin.ts`)

```typescript
interface DigitalTwin {
  // Initialize from current database state
  initialize(): Promise<void>;
  
  // Get current baseline state
  getBaseline(): WarehouseState;
  
  // Run scenario simulation
  runScenario(scenario: Scenario): SimulationResult;
  
  // Compare multiple scenarios
  compareScenarios(scenarios: Scenario[]): ComparisonResult;
}

interface WarehouseState {
  storage: StorageModel;
  throughput: ThroughputModel;
  labor: LaborModel;
  leadTime: LeadTimeModel;
  orderPatterns: OrderPatternModel;
  timestamp: string;
}
```

### 2. Storage Model (`lib/simulation/models/storage-model.ts`)

```typescript
interface StorageModel {
  locations: LocationCapacity[];
  zones: ZoneCapacity[];
  warehouses: WarehouseCapacity[];
  
  // Methods
  getUtilization(): UtilizationMetrics;
  applyCapacityChange(change: CapacityChange): StorageModel;
  calculateOverflow(): OverflowAnalysis;
}

interface LocationCapacity {
  location_id: string;
  location_code: string;
  zone: string;
  warehouse_id: string;
  max_capacity: number;
  current_qty: number;
  utilization_percent: number;
}
```

### 3. Throughput Model (`lib/simulation/models/throughput-model.ts`)

```typescript
interface ThroughputModel {
  inbound: InboundMetrics;
  outbound: OutboundMetrics;
  historical_peak: PeakMetrics;
  
  // Methods
  applyDemandMultiplier(multiplier: number): ThroughputModel;
  identifyBottlenecks(): Bottleneck[];
}

interface InboundMetrics {
  avg_daily_qty: number;
  avg_daily_orders: number;
  avg_daily_pallets: number;
  peak_daily_qty: number;
}
```

### 4. Labor Model (`lib/simulation/models/labor-model.ts`)

```typescript
interface LaborModel {
  headcount: HeadcountByRole;
  productivity: ProductivityRates;
  capacity: DailyCapacity;
  
  // Methods
  applyWorkforceChange(change: WorkforceChange): LaborModel;
  calculateRequiredWorkers(demand: number): number;
}

interface ProductivityRates {
  picks_per_hour_per_picker: number;
  receives_per_hour_per_receiver: number;
  loads_per_hour_per_loader: number;
}
```

### 5. Lead Time Model (`lib/simulation/models/leadtime-model.ts`)

```typescript
interface LeadTimeModel {
  suppliers: SupplierLeadTime[];
  
  // Methods
  applyLeadTimeIncrease(days: number): LeadTimeModel;
  calculateSafetyStock(sku_id: string): number;
}

interface SupplierLeadTime {
  supplier_id: string;
  supplier_name: string;
  avg_lead_time: number;
  p50_lead_time: number;
  p90_lead_time: number;
  std_deviation: number;
  variability_score: 'low' | 'medium' | 'high';
}
```

### 6. Scenario Engine (`lib/simulation/scenario-engine.ts`)

```typescript
interface ScenarioEngine {
  // Run specific scenario types
  runDemandIncrease(params: DemandScenarioParams): SimulationResult;
  runLeadTimeIncrease(params: LeadTimeScenarioParams): SimulationResult;
  runStorageReduction(params: StorageScenarioParams): SimulationResult;
  runShiftChange(params: ShiftScenarioParams): SimulationResult;
  
  // Analysis
  analyzeBottlenecks(state: WarehouseState): BottleneckAnalysis;
  assessRisks(state: WarehouseState): RiskAssessment;
  calculateKPIDelta(baseline: WarehouseState, scenario: WarehouseState): KPIDelta;
}

interface SimulationResult {
  scenario_id: string;
  scenario_type: string;
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
```

### 7. Simulation API (`app/api/ai/simulation/[type]/route.ts`)

```typescript
// POST /api/ai/simulation/demand-increase
// POST /api/ai/simulation/lead-time-increase
// POST /api/ai/simulation/storage-reduction
// POST /api/ai/simulation/shift-change
// POST /api/ai/simulation/compare

interface SimulationRequest {
  scenario_type: string;
  parameters: Record<string, any>;
  compare_with?: string[]; // scenario_ids for comparison
}

interface SimulationResponse {
  success: boolean;
  data: SimulationResult | ComparisonResult;
  metadata: {
    calculation_method: string;
    data_sources: string[];
    data_period: string;
    confidence_level: string;
    generated_at: string;
  };
  disclaimer: string;
}
```

## Data Models

### Scenario Parameters

```typescript
interface DemandScenarioParams {
  demand_multiplier: number; // e.g., 1.2 for 20% increase
  period_days?: number; // simulation period
}

interface LeadTimeScenarioParams {
  lead_time_increase_days: number;
  supplier_ids?: string[]; // specific suppliers, or all if empty
}

interface StorageScenarioParams {
  reduction_percent?: number;
  reduction_locations?: string[]; // specific locations to remove
  affected_zones?: string[];
}

interface ShiftScenarioParams {
  shift_hours_change?: number;
  worker_count_change?: number;
  productivity_change_percent?: number;
}
```

### Analysis Results

```typescript
interface KPIDelta {
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

interface Bottleneck {
  resource_type: 'storage' | 'labor' | 'equipment' | 'process';
  resource_id: string;
  resource_name: string;
  current_utilization: number;
  max_capacity: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  throughput_impact: number;
  resolution_options: string[];
}

interface Risk {
  risk_type: 'stockout' | 'overflow' | 'service_level' | 'expiry';
  risk_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  affected_items: string[];
  contributing_factors: string[];
  mitigation_options: string[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Utilization Calculation Correctness
*For any* location with max_capacity > 0, the utilization_percent SHALL equal (current_qty / max_capacity) * 100
**Validates: Requirements 1.2**

### Property 2: Zone Aggregation Correctness
*For any* set of locations in a zone, the zone total_capacity SHALL equal the sum of all location max_capacities, and zone current_qty SHALL equal the sum of all location current_qtys
**Validates: Requirements 1.3**

### Property 3: Simulation Isolation
*For any* simulation run, the real database tables (master_location, wms_inventory_balances, etc.) SHALL remain unchanged after simulation completes
**Validates: Requirements 1.5, 14.2**

### Property 4: Overflow Detection
*For any* location where simulated current_qty > max_capacity, the system SHALL flag overflow = true and calculate overflow_qty = current_qty - max_capacity
**Validates: Requirements 1.6**

### Property 5: Demand Multiplier Application
*For any* demand increase scenario with multiplier M, the simulated daily_orders SHALL equal baseline daily_orders * M
**Validates: Requirements 6.2, 6.3**

### Property 6: Lead Time Addition
*For any* lead time increase scenario with increase D days, the simulated lead_time for each supplier SHALL equal baseline lead_time + D
**Validates: Requirements 7.2, 7.3**

### Property 7: Storage Reduction Calculation
*For any* storage reduction scenario with reduction R%, the simulated total_capacity SHALL equal baseline total_capacity * (1 - R/100)
**Validates: Requirements 8.2, 8.3**

### Property 8: Labor Capacity Calculation
*For any* labor model, daily_capacity SHALL equal workers * hours_per_shift * productivity_rate
**Validates: Requirements 3.5**

### Property 9: KPI Delta Calculation
*For any* KPI comparison, absolute_delta SHALL equal simulated_value - baseline_value, and percent_delta SHALL equal (absolute_delta / baseline_value) * 100
**Validates: Requirements 13.1, 13.2**

### Property 10: Simulation Reproducibility
*For any* simulation with identical parameters and data snapshot, running the simulation multiple times SHALL produce identical results
**Validates: Requirements 16.1, 16.2**

### Property 11: Bottleneck Identification
*For any* warehouse state, the primary_bottleneck SHALL be the resource with the highest utilization_percent
**Validates: Requirements 11.1**

### Property 12: Risk Score Bounds
*For any* risk assessment, all risk_scores SHALL be within the range [0, 100]
**Validates: Requirements 12.5**

## Error Handling

### Input Validation
- Validate all scenario parameters before simulation
- Reject invalid multipliers (e.g., negative demand_multiplier)
- Reject invalid percentages (e.g., reduction > 100%)

### Data Quality
- Check minimum data points (30 days) for statistical calculations
- Flag low confidence when data is insufficient
- Handle missing data gracefully with defaults

### Calculation Errors
- Prevent division by zero (e.g., when max_capacity = 0)
- Handle edge cases (empty warehouse, no historical data)
- Return clear error messages with validation details

## Testing Strategy

### Unit Tests
- Test each model's calculation methods
- Test scenario parameter validation
- Test KPI delta calculations

### Property-Based Tests
- Use fast-check library for TypeScript
- Test mathematical properties (utilization, aggregation)
- Test invariants (simulation isolation, reproducibility)
- Each property test runs minimum 100 iterations

### Integration Tests
- Test full simulation flow from API to result
- Test scenario comparison functionality
- Test AI Chat integration

### Test Annotations
Each property-based test MUST include:
- `**Feature: warehouse-digital-twin, Property {number}: {property_text}**`
- Reference to the requirement being validated

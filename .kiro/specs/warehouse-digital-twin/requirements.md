# Requirements Document: Warehouse Digital Twin & What-If Scenario Engine

## Introduction

ระบบ Digital Twin และ What-If Scenario Engine สำหรับระบบจัดการคลังสินค้า (Warehouse Management System - WMS) ที่ทำงานบน Next.js 15.5+ และ Supabase PostgreSQL

ระบบนี้สร้าง "ฝาแฝดดิจิทัล" (Digital Twin) ของคลังสินค้าจริง เพื่อให้ผู้ใช้สามารถ:
- จำลองสถานการณ์ต่างๆ โดยไม่กระทบข้อมูลจริง
- วิเคราะห์ผลกระทบของการเปลี่ยนแปลง (What-If Analysis)
- เปรียบเทียบ scenarios หลายๆ แบบ
- ระบุ bottlenecks และความเสี่ยงล่วงหน้า

**หลักการสำคัญ:**
- NO AI PREDICTION - ใช้เฉพาะ historical distributions และ deterministic calculations
- NO REAL-WORLD SIDE EFFECTS - การจำลองไม่กระทบข้อมูลจริง
- REPRODUCIBLE - ผลลัพธ์เดียวกันทุกครั้งจาก parameters เดียวกัน
- EXPLAINABLE - อธิบายได้ว่าคำนวณมาอย่างไร

## Glossary

- **Digital_Twin**: โมเดลเสมือนของคลังสินค้าที่สะท้อนสถานะและพฤติกรรมของคลังจริง
- **Scenario**: ชุดของ parameters ที่กำหนดสถานการณ์สมมติ
- **Baseline**: สถานะปัจจุบันของคลังสินค้าที่ใช้เป็นจุดเริ่มต้นในการเปรียบเทียบ
- **Simulation**: การรันโมเดลด้วย scenario ที่กำหนดเพื่อดูผลลัพธ์
- **KPI_Delta**: ความแตกต่างของ KPI ระหว่าง baseline และ scenario
- **Bottleneck**: จุดคอขวดที่จำกัดประสิทธิภาพของระบบ
- **Throughput**: ปริมาณงานที่ผ่านระบบต่อหน่วยเวลา
- **Capacity**: ความจุสูงสุดของทรัพยากร (พื้นที่, แรงงาน, อุปกรณ์)
- **Lead_Time**: ระยะเวลาตั้งแต่สั่งซื้อจนถึงรับสินค้า
- **Historical_Distribution**: การกระจายตัวของข้อมูลจากประวัติการทำงาน
- **Constraint**: ข้อจำกัดของระบบ เช่น พื้นที่, แรงงาน, เวลา
- **Impact_Analysis**: การวิเคราะห์ผลกระทบของการเปลี่ยนแปลง

## Requirements

### Requirement 1: Digital Twin Model - Storage Capacity

**User Story:** As a warehouse manager, I want a virtual model of storage capacity, so that I can simulate space utilization under different scenarios.

#### Acceptance Criteria

1. WHEN the Digital_Twin initializes THEN the System SHALL load current storage capacity from master_location table including location_id, zone, max_capacity_qty, current_qty
2. WHEN the Digital_Twin models storage THEN the System SHALL calculate utilization_percent as (current_qty / max_capacity_qty) * 100 for each location
3. WHEN the Digital_Twin aggregates by zone THEN the System SHALL sum capacities and calculate zone-level utilization
4. WHEN the Digital_Twin aggregates by warehouse THEN the System SHALL sum all locations and calculate warehouse-level utilization
5. WHEN a scenario modifies storage capacity THEN the Digital_Twin SHALL recalculate utilization without affecting real master_location data
6. WHEN storage utilization exceeds 100% in simulation THEN the Digital_Twin SHALL flag as overflow and calculate overflow_qty
7. WHEN the Digital_Twin reports storage THEN the System SHALL include total_capacity, used_capacity, available_capacity, utilization_percent, overflow_qty

### Requirement 2: Digital Twin Model - Throughput Limits

**User Story:** As a warehouse manager, I want a virtual model of throughput limits, so that I can simulate processing capacity under different demand levels.

#### Acceptance Criteria

1. WHEN the Digital_Twin initializes throughput model THEN the System SHALL calculate historical avg_daily_inbound and avg_daily_outbound from wms_inventory_ledger
2. WHEN calculating throughput THEN the System SHALL use data from the last 30 days as default period
3. WHEN the Digital_Twin models inbound throughput THEN the System SHALL include receiving_orders_per_day, pieces_received_per_day, pallets_received_per_day
4. WHEN the Digital_Twin models outbound throughput THEN the System SHALL include orders_shipped_per_day, pieces_shipped_per_day, picks_per_day
5. WHEN the Digital_Twin calculates peak throughput THEN the System SHALL identify max_daily_inbound and max_daily_outbound from historical data
6. WHEN a scenario increases demand THEN the Digital_Twin SHALL compare new_demand against historical_peak to identify capacity risk
7. WHEN throughput exceeds historical peak THEN the Digital_Twin SHALL flag as potential_bottleneck with severity level

### Requirement 3: Digital Twin Model - Labor Constraints

**User Story:** As a warehouse manager, I want a virtual model of labor capacity, so that I can simulate workforce requirements under different scenarios.

#### Acceptance Criteria

1. WHEN the Digital_Twin initializes labor model THEN the System SHALL load employee count by role from master_employee table
2. WHEN the Digital_Twin models labor capacity THEN the System SHALL calculate picks_per_hour_per_picker from historical picklist completion data
3. WHEN the Digital_Twin models labor capacity THEN the System SHALL calculate receives_per_hour_per_receiver from historical receiving data
4. WHEN the Digital_Twin models labor capacity THEN the System SHALL calculate loads_per_hour_per_loader from historical loading data
5. WHEN a scenario changes workforce size THEN the Digital_Twin SHALL recalculate total_daily_capacity as workers * hours_per_shift * productivity_rate
6. WHEN demand exceeds labor capacity THEN the Digital_Twin SHALL calculate required_overtime_hours or additional_workers_needed
7. WHEN the Digital_Twin reports labor THEN the System SHALL include current_headcount, productivity_rate, daily_capacity, utilization_percent

### Requirement 4: Digital Twin Model - Lead Times

**User Story:** As a warehouse manager, I want a virtual model of supplier lead times, so that I can simulate inventory replenishment scenarios.

#### Acceptance Criteria

1. WHEN the Digital_Twin initializes lead time model THEN the System SHALL calculate historical lead times from receiving_orders (order_date to received_date)
2. WHEN calculating lead times THEN the System SHALL group by supplier_id to get supplier-specific lead times
3. WHEN the Digital_Twin models lead time THEN the System SHALL calculate p50_lead_time (median) and p90_lead_time (90th percentile) for each supplier
4. WHEN the Digital_Twin models lead time THEN the System SHALL calculate avg_lead_time and std_deviation for variability analysis
5. WHEN a scenario increases lead time THEN the Digital_Twin SHALL recalculate safety_stock_required and reorder_point
6. WHEN lead time variability is high (std > 3 days) THEN the Digital_Twin SHALL flag supplier as high_variability_risk
7. WHEN the Digital_Twin reports lead times THEN the System SHALL include supplier_id, avg_lead_time, p50_lead_time, p90_lead_time, variability_score

### Requirement 5: Digital Twin Model - Order Arrival Patterns

**User Story:** As a warehouse manager, I want a virtual model of order arrival patterns, so that I can simulate demand fluctuations.

#### Acceptance Criteria

1. WHEN the Digital_Twin initializes order pattern model THEN the System SHALL analyze wms_orders to identify daily, weekly, and monthly patterns
2. WHEN analyzing patterns THEN the System SHALL calculate avg_orders_per_day, avg_orders_per_weekday, peak_day_of_week
3. WHEN analyzing patterns THEN the System SHALL identify seasonality_factor for each month based on historical data
4. WHEN the Digital_Twin models order arrival THEN the System SHALL use historical distribution to generate realistic order volumes
5. WHEN a scenario specifies demand_multiplier THEN the Digital_Twin SHALL apply multiplier to historical average
6. WHEN generating simulated orders THEN the Digital_Twin SHALL maintain realistic distribution (not uniform) based on historical patterns
7. WHEN the Digital_Twin reports patterns THEN the System SHALL include daily_avg, weekly_pattern, monthly_seasonality, peak_periods

### Requirement 6: What-If Scenario - Demand Increase

**User Story:** As a warehouse manager, I want to simulate demand increase scenarios, so that I can prepare for growth or peak seasons.

#### Acceptance Criteria

1. WHEN a user creates demand increase scenario THEN the System SHALL accept demand_multiplier parameter (e.g., 1.2 for 20% increase)
2. WHEN simulating demand increase THEN the Digital_Twin SHALL multiply avg_daily_orders by demand_multiplier
3. WHEN simulating demand increase THEN the Digital_Twin SHALL calculate new_daily_picks as current_picks * demand_multiplier
4. WHEN simulating demand increase THEN the Digital_Twin SHALL calculate new_daily_outbound as current_outbound * demand_multiplier
5. WHEN demand exceeds capacity THEN the Digital_Twin SHALL identify which resource becomes bottleneck first (labor, space, equipment)
6. WHEN simulating demand increase THEN the Digital_Twin SHALL calculate days_until_stockout for each SKU based on new consumption rate
7. WHEN the scenario completes THEN the System SHALL return impact_analysis with KPI_delta, bottlenecks, and risk_assessment

### Requirement 7: What-If Scenario - Lead Time Increase

**User Story:** As a warehouse manager, I want to simulate supplier lead time increase scenarios, so that I can assess inventory risk.

#### Acceptance Criteria

1. WHEN a user creates lead time scenario THEN the System SHALL accept lead_time_increase_days parameter
2. WHEN simulating lead time increase THEN the Digital_Twin SHALL add lead_time_increase_days to current supplier lead times
3. WHEN simulating lead time increase THEN the Digital_Twin SHALL recalculate safety_stock_required for each SKU
4. WHEN simulating lead time increase THEN the Digital_Twin SHALL identify SKUs that will stockout before new orders arrive
5. WHEN simulating lead time increase THEN the Digital_Twin SHALL calculate additional_inventory_investment needed to maintain service level
6. WHEN lead time increases significantly THEN the Digital_Twin SHALL flag high_risk_skus that have low days_of_cover
7. WHEN the scenario completes THEN the System SHALL return impact_analysis with stockout_risk, safety_stock_delta, and investment_required

### Requirement 8: What-If Scenario - Storage Reduction

**User Story:** As a warehouse manager, I want to simulate storage area reduction scenarios, so that I can plan for space constraints.

#### Acceptance Criteria

1. WHEN a user creates storage reduction scenario THEN the System SHALL accept reduction_percent or reduction_locations parameters
2. WHEN simulating storage reduction THEN the Digital_Twin SHALL reduce total_capacity by specified amount
3. WHEN simulating storage reduction THEN the Digital_Twin SHALL recalculate utilization_percent with reduced capacity
4. WHEN utilization exceeds 100% THEN the Digital_Twin SHALL calculate overflow_qty that cannot be stored
5. WHEN simulating storage reduction THEN the Digital_Twin SHALL identify which zones are most impacted
6. WHEN simulating storage reduction THEN the Digital_Twin SHALL calculate max_inventory_level that can be maintained
7. WHEN the scenario completes THEN the System SHALL return impact_analysis with new_utilization, overflow_risk, and affected_zones

### Requirement 9: What-If Scenario - Shift Capacity Change

**User Story:** As a warehouse manager, I want to simulate shift capacity changes, so that I can plan workforce adjustments.

#### Acceptance Criteria

1. WHEN a user creates shift scenario THEN the System SHALL accept parameters: shift_hours_change, worker_count_change, productivity_change_percent
2. WHEN simulating shift change THEN the Digital_Twin SHALL recalculate daily_labor_capacity based on new parameters
3. WHEN simulating shift change THEN the Digital_Twin SHALL compare new_capacity against current_demand
4. WHEN capacity decreases below demand THEN the Digital_Twin SHALL calculate backlog_accumulation_rate
5. WHEN simulating shift change THEN the Digital_Twin SHALL calculate cost_impact based on labor_cost_per_hour
6. WHEN capacity increases THEN the Digital_Twin SHALL calculate excess_capacity and potential_throughput_increase
7. WHEN the scenario completes THEN the System SHALL return impact_analysis with capacity_delta, cost_impact, and service_level_impact

### Requirement 10: Scenario Comparison

**User Story:** As a warehouse manager, I want to compare multiple scenarios side by side, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN a user requests scenario comparison THEN the System SHALL accept array of scenario_ids to compare
2. WHEN comparing scenarios THEN the System SHALL include baseline (current state) as reference point
3. WHEN comparing scenarios THEN the System SHALL calculate KPI_delta for each scenario vs baseline
4. WHEN displaying comparison THEN the System SHALL show key metrics: throughput_delta, utilization_delta, cost_delta, risk_delta
5. WHEN comparing scenarios THEN the System SHALL rank scenarios by user-specified criteria (cost, risk, capacity)
6. WHEN comparing scenarios THEN the System SHALL highlight trade-offs between scenarios
7. WHEN the comparison completes THEN the System SHALL return comparison_matrix with all scenarios and metrics

### Requirement 11: Bottleneck Analysis

**User Story:** As a warehouse manager, I want automatic bottleneck identification, so that I can focus on the most critical constraints.

#### Acceptance Criteria

1. WHEN analyzing bottlenecks THEN the Digital_Twin SHALL identify resource with highest utilization as primary_bottleneck
2. WHEN analyzing bottlenecks THEN the Digital_Twin SHALL calculate bottleneck_severity as (demand - capacity) / capacity
3. WHEN analyzing bottlenecks THEN the Digital_Twin SHALL identify secondary_bottlenecks that would become primary if first is resolved
4. WHEN a bottleneck is identified THEN the System SHALL calculate throughput_loss due to the constraint
5. WHEN analyzing bottlenecks THEN the System SHALL categorize by type: storage, labor, equipment, process
6. WHEN reporting bottlenecks THEN the System SHALL include bottleneck_type, severity, impact_on_throughput, resolution_options
7. WHEN multiple bottlenecks exist THEN the System SHALL prioritize by impact on overall system performance

### Requirement 12: Risk Impact Assessment

**User Story:** As a warehouse manager, I want risk impact assessment for each scenario, so that I can understand potential consequences.

#### Acceptance Criteria

1. WHEN assessing risk THEN the Digital_Twin SHALL calculate stockout_risk based on days_of_cover vs lead_time
2. WHEN assessing risk THEN the Digital_Twin SHALL calculate overflow_risk based on utilization vs capacity
3. WHEN assessing risk THEN the Digital_Twin SHALL calculate service_level_risk based on capacity vs demand
4. WHEN assessing risk THEN the Digital_Twin SHALL calculate expiry_risk based on inventory age vs shelf_life
5. WHEN calculating risk scores THEN the System SHALL use 0-100 scale with thresholds: low (0-30), medium (31-60), high (61-80), critical (81-100)
6. WHEN reporting risks THEN the System SHALL include risk_type, risk_score, risk_level, contributing_factors, mitigation_options
7. WHEN multiple risks exist THEN the System SHALL calculate overall_risk_score as weighted average

### Requirement 13: KPI Delta Calculation

**User Story:** As a warehouse manager, I want clear KPI comparisons between baseline and scenarios, so that I can quantify the impact of changes.

#### Acceptance Criteria

1. WHEN calculating KPI delta THEN the System SHALL compare scenario_value vs baseline_value for each KPI
2. WHEN calculating KPI delta THEN the System SHALL express change as both absolute_delta and percent_delta
3. WHEN calculating KPI delta THEN the System SHALL include: throughput_delta, utilization_delta, cost_delta, risk_delta, service_level_delta
4. WHEN displaying KPI delta THEN the System SHALL use color coding: green for improvement, red for degradation, yellow for neutral
5. WHEN KPI delta exceeds threshold THEN the System SHALL flag as significant_change requiring attention
6. WHEN calculating cost delta THEN the System SHALL include labor_cost, storage_cost, stockout_cost estimates
7. WHEN the calculation completes THEN the System SHALL return kpi_comparison with baseline_values, scenario_values, and deltas

### Requirement 14: Simulation API

**User Story:** As a developer, I want a clean API for running simulations, so that the Digital Twin can be integrated with AI Chat and other systems.

#### Acceptance Criteria

1. WHEN calling simulation API THEN the System SHALL accept scenario_type and scenario_parameters as input
2. WHEN running simulation THEN the System SHALL NOT modify any real database tables
3. WHEN running simulation THEN the System SHALL use in-memory calculations based on snapshot of current data
4. WHEN simulation completes THEN the System SHALL return structured response with results, metadata, and disclaimer
5. WHEN simulation fails THEN the System SHALL return error with clear message and validation details
6. WHEN calling API THEN the System SHALL validate all parameters before running simulation
7. WHEN returning results THEN the System SHALL include calculation_method, data_sources, assumptions, and confidence_level

### Requirement 15: AI Chat Integration

**User Story:** As a user, I want to ask AI Chat about simulation results, so that I can understand the implications of different scenarios.

#### Acceptance Criteria

1. WHEN a user asks about what-if scenarios THEN AI Chat SHALL detect intent and call appropriate simulation API
2. WHEN explaining results THEN AI Chat SHALL describe KPI changes in natural language (Thai)
3. WHEN explaining results THEN AI Chat SHALL highlight key risks and bottlenecks
4. WHEN comparing scenarios THEN AI Chat SHALL summarize trade-offs between options
5. WHEN explaining results THEN AI Chat SHALL NOT recommend specific actions autonomously
6. WHEN explaining results THEN AI Chat SHALL present options and let user decide
7. WHEN displaying results THEN AI Chat SHALL include disclaimer that simulations are estimates based on historical data

### Requirement 16: Simulation Reproducibility

**User Story:** As a warehouse manager, I want reproducible simulation results, so that I can trust and verify the analysis.

#### Acceptance Criteria

1. WHEN running simulation THEN the System SHALL use deterministic calculations (no random elements)
2. WHEN running simulation with same parameters THEN the System SHALL produce identical results
3. WHEN storing simulation THEN the System SHALL save all input parameters and data snapshot timestamp
4. WHEN retrieving past simulation THEN the System SHALL be able to reproduce results using saved parameters
5. WHEN data changes THEN the System SHALL clearly indicate that new simulation may differ from past results
6. WHEN reporting results THEN the System SHALL include simulation_id, timestamp, and parameter_hash for verification
7. WHEN auditing simulations THEN the System SHALL maintain log of all simulations run with parameters and results

### Requirement 17: Historical Data Usage

**User Story:** As a warehouse manager, I want simulations based on real historical data, so that results are grounded in actual operations.

#### Acceptance Criteria

1. WHEN initializing Digital Twin THEN the System SHALL use actual data from wms_inventory_ledger, wms_orders, master_location
2. WHEN calculating distributions THEN the System SHALL use minimum 30 days of historical data for statistical validity
3. WHEN historical data is insufficient THEN the System SHALL flag low_confidence and use available data with warning
4. WHEN calculating averages THEN the System SHALL exclude outliers beyond 3 standard deviations
5. WHEN using historical patterns THEN the System SHALL weight recent data more heavily than older data
6. WHEN reporting data sources THEN the System SHALL include data_period, data_points_count, and data_quality_score
7. WHEN data quality is low THEN the System SHALL include warning in results about reduced confidence

### Requirement 18: Scenario Templates

**User Story:** As a warehouse manager, I want pre-built scenario templates, so that I can quickly run common what-if analyses.

#### Acceptance Criteria

1. WHEN the System initializes THEN the System SHALL provide template: "Peak Season" with demand_multiplier = 1.5
2. WHEN the System initializes THEN the System SHALL provide template: "Supplier Delay" with lead_time_increase = 7 days
3. WHEN the System initializes THEN the System SHALL provide template: "Space Constraint" with storage_reduction = 20%
4. WHEN the System initializes THEN the System SHALL provide template: "Reduced Workforce" with worker_reduction = 25%
5. WHEN the System initializes THEN the System SHALL provide template: "Growth Planning" with demand_multiplier = 2.0
6. WHEN a user selects template THEN the System SHALL pre-fill parameters that can be adjusted
7. WHEN displaying templates THEN the System SHALL include template_name, description, default_parameters, and typical_use_case

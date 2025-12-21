# Implementation Plan: Warehouse Digital Twin & What-If Scenario Engine

- [x] 1. Set up project structure and core types
  - Create `lib/simulation/` directory structure
  - Define TypeScript interfaces for all models and scenarios
  - Set up fast-check for property-based testing
  - _Requirements: 1.1, 14.1_

- [x] 2. Implement Storage Model
  - [x] 2.1 Create storage model with location capacity calculations
    - Implement `LocationCapacity`, `ZoneCapacity`, `WarehouseCapacity` types
    - Implement `getUtilization()` method
    - Implement `applyCapacityChange()` method
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for utilization calculation
    - **Property 1: Utilization Calculation Correctness**
    - **Validates: Requirements 1.2**

  - [x] 2.3 Write property test for zone aggregation
    - **Property 2: Zone Aggregation Correctness**
    - **Validates: Requirements 1.3**

  - [x] 2.4 Implement overflow detection
    - Implement `calculateOverflow()` method
    - Flag locations with utilization > 100%
    - _Requirements: 1.6, 1.7_

  - [x] 2.5 Write property test for overflow detection
    - **Property 4: Overflow Detection**
    - **Validates: Requirements 1.6**

- [x] 3. Implement Throughput Model
  - [x] 3.1 Create throughput model with historical calculations
    - Implement `InboundMetrics`, `OutboundMetrics` types
    - Calculate avg_daily from wms_inventory_ledger
    - Calculate peak_daily from historical data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Implement demand multiplier application
    - Implement `applyDemandMultiplier()` method
    - Compare against historical peak
    - _Requirements: 2.6, 2.7_

  - [x] 3.3 Write property test for demand multiplier
    - **Property 5: Demand Multiplier Application**
    - **Validates: Requirements 6.2, 6.3**

- [x] 4. Implement Labor Model
  - [x] 4.1 Create labor model with productivity calculations
    - Implement `HeadcountByRole`, `ProductivityRates` types
    - Calculate productivity from historical picklist data
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Implement workforce change calculations
    - Implement `applyWorkforceChange()` method
    - Calculate required overtime/additional workers
    - _Requirements: 3.5, 3.6, 3.7_

  - [x] 4.3 Write property test for labor capacity calculation
    - **Property 8: Labor Capacity Calculation**
    - **Validates: Requirements 3.5**

- [x] 5. Implement Lead Time Model
  - [x] 5.1 Create lead time model with supplier statistics
    - Implement `SupplierLeadTime` type
    - Calculate p50, p90, std_deviation from receiving_orders
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Implement lead time increase calculations
    - Implement `applyLeadTimeIncrease()` method
    - Recalculate safety stock requirements
    - _Requirements: 4.5, 4.6, 4.7_

  - [x] 5.3 Write property test for lead time addition
    - **Property 6: Lead Time Addition**
    - **Validates: Requirements 7.2, 7.3**

- [x] 6. Implement Order Pattern Model
  - [x] 6.1 Create order pattern model with historical analysis
    - Analyze daily, weekly, monthly patterns from wms_orders
    - Calculate seasonality factors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 7. Checkpoint - Ensure all model tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Digital Twin Engine
  - [x] 8.1 Create main Digital Twin class
    - Implement `initialize()` to load current state from database
    - Implement `getBaseline()` to return current warehouse state
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

  - [x] 8.2 Implement data snapshot mechanism
    - Create read-only snapshot of database state
    - Ensure simulations use snapshot, not live data
    - _Requirements: 14.2, 14.3_

  - [x] 8.3 Write property test for simulation isolation
    - **Property 3: Simulation Isolation**
    - **Validates: Requirements 1.5, 14.2**

- [x] 9. Implement Scenario Engine
  - [x] 9.1 Create scenario engine with demand increase simulation
    - Implement `runDemandIncrease()` method
    - Apply multiplier to throughput model
    - Calculate impact on all models
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 9.2 Implement lead time increase simulation
    - Implement `runLeadTimeIncrease()` method
    - Recalculate safety stock and stockout risk
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 9.3 Implement storage reduction simulation
    - Implement `runStorageReduction()` method
    - Recalculate utilization and overflow
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 9.4 Write property test for storage reduction
    - **Property 7: Storage Reduction Calculation**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 9.5 Implement shift change simulation
    - Implement `runShiftChange()` method
    - Recalculate labor capacity and cost impact
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 10. Implement Analysis Functions
  - [x] 10.1 Implement bottleneck analysis
    - Identify primary and secondary bottlenecks
    - Calculate severity and throughput impact
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 10.2 Write property test for bottleneck identification
    - **Property 11: Bottleneck Identification**
    - **Validates: Requirements 11.1**

  - [x] 10.3 Implement risk assessment
    - Calculate stockout, overflow, service level, expiry risks
    - Generate risk scores and mitigation options
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 10.4 Write property test for risk score bounds
    - **Property 12: Risk Score Bounds**
    - **Validates: Requirements 12.5**

  - [x] 10.5 Implement KPI delta calculation
    - Calculate absolute and percent deltas
    - Include throughput, utilization, labor, risk deltas
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 10.6 Write property test for KPI delta calculation
    - **Property 9: KPI Delta Calculation**
    - **Validates: Requirements 13.1, 13.2**

- [ ] 11. Checkpoint - Ensure all engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Scenario Comparison
  - [x] 12.1 Implement scenario comparison functionality
    - Compare multiple scenarios against baseline
    - Rank scenarios by specified criteria
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 12.2 Write property test for simulation reproducibility
    - **Property 10: Simulation Reproducibility**
    - **Validates: Requirements 16.1, 16.2**

- [x] 13. Implement Simulation APIs
  - [x] 13.1 Create demand increase API endpoint
    - POST /api/ai/simulation/demand-increase
    - Validate parameters and return structured response
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7_

  - [x] 13.2 Create lead time increase API endpoint
    - POST /api/ai/simulation/lead-time-increase
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7_

  - [x] 13.3 Create storage reduction API endpoint
    - POST /api/ai/simulation/storage-reduction
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7_

  - [x] 13.4 Create shift change API endpoint
    - POST /api/ai/simulation/shift-change
    - _Requirements: 14.1, 14.4, 14.5, 14.6, 14.7_

  - [x] 13.5 Create scenario comparison API endpoint
    - POST /api/ai/simulation/compare
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 14. Implement Scenario Templates
  - [x] 14.1 Create pre-built scenario templates
    - Peak Season (demand_multiplier = 1.5)
    - Supplier Delay (lead_time_increase = 7)
    - Space Constraint (storage_reduction = 20%)
    - Reduced Workforce (worker_reduction = 25%)
    - Growth Planning (demand_multiplier = 2.0)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

- [x] 15. Integrate with AI Chat
  - [x] 15.1 Add simulation intent detection to chat service
    - Detect what-if scenario questions
    - Route to appropriate simulation API
    - _Requirements: 15.1_

  - [x] 15.2 Add simulation response formatters
    - Format KPI deltas in Thai
    - Highlight risks and bottlenecks
    - Include disclaimers
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 15.3 Update AI Chat greeting with simulation capabilities
    - Add simulation examples to greeting
    - _Requirements: 15.1_

- [x] 16. Create Documentation
  - [x] 16.1 Create SIMULATION_DEFINITION.md
    - Document all scenario types and parameters
    - Document calculation methods
    - Include usage examples
    - _Requirements: 17.6_

- [ ] 17. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

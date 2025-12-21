# PHASE 3: AI-READY DATA & API SPECIFICATION

**Date**: December 21, 2025
**Purpose**: Define complete API layer for AI/LLM warehouse assistant
**Scope**: Read-only APIs that expose ALL warehouse operational data

---

## DESIGN PRINCIPLES

### 1. **AI Safety**
- AI NEVER queries database directly
- AI ONLY consumes controlled, read-only APIs
- All data access through explicit API endpoints
- No write operations from AI
- All mutations require user confirmation

### 2. **Data Completeness**
- APIs cover 100% of warehouse operations
- No hypothetical data - only real system data
- Reflect actual business logic
- Include calculated fields and aggregations

### 3. **Response Format**
- Consistent JSON structure
- Thai language support
- Proper error handling
- Pagination for large datasets
- Metadata included (counts, totals, timestamps)

---

## DATA DOMAINS & REQUIRED APIs

Based on comprehensive system audit, the AI requires access to these domains:

### DOMAIN 1: STOCK & INVENTORY

#### 1.1 Stock Balance Query
```
GET /api/ai/stock/balance
```

**Purpose**: Query current stock levels by various criteria

**Parameters**:
```typescript
{
  sku_id?: string;           // Specific SKU
  location_id?: string;      // Specific location
  warehouse_id?: string;     // Warehouse filter
  zone?: string;             // Zone filter
  lot_no?: string;           // Lot number
  production_date_from?: string;
  production_date_to?: string;
  expiry_date_from?: string;
  expiry_date_to?: string;
  min_quantity?: number;     // Minimum piece qty
  include_reserved?: boolean; // Include reserved stock
  include_expired?: boolean;  // Include expired stock
  limit?: number;
  offset?: number;
}
```

**Response**:
```typescript
{
  data: [{
    id: number;
    sku_id: string;
    sku_name: string;
    location_id: string;
    location_code: string;
    location_name: string;
    warehouse_name: string;
    zone: string;
    piece_qty: number;
    reserved_piece_qty: number;
    available_qty: number;      // Calculated: piece_qty - reserved_piece_qty
    production_date: string | null;
    expiry_date: string | null;
    lot_no: string | null;
    pallet_id: string | null;
    last_updated: string;
  }],
  metadata: {
    total_count: number;
    total_quantity: number;      // Sum of all piece_qty
    total_available: number;     // Sum of all available_qty
    total_reserved: number;      // Sum of all reserved_piece_qty
    unique_skus: number;
    unique_locations: number;
  }
}
```

**Business Logic Applied**:
- Available qty = piece_qty - reserved_piece_qty
- Expired stock identified by expiry_date < today
- Location hierarchy flattened for easy querying

---

#### 1.2 Stock Movement History
```
GET /api/ai/stock/movements
```

**Purpose**: Track stock movements (in/out/transfer)

**Parameters**:
```typescript
{
  sku_id?: string;
  location_id?: string;
  warehouse_id?: string;
  movement_type?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUST';
  date_from?: string;
  date_to?: string;
  reference_doc?: string;     // Document number
  reference_type?: 'RECEIVE' | 'PICK' | 'MOVE' | 'ADJUST' | 'PRODUCTION';
  employee_id?: number;
  limit?: number;
  offset?: number;
}
```

**Response**:
```typescript
{
  data: [{
    id: number;
    sku_id: string;
    sku_name: string;
    location_code: string;
    movement_type: string;
    quantity: number;           // Positive for IN, Negative for OUT
    reference_doc_no: string;
    reference_doc_type: string;
    created_at: string;
    employee_name: string | null;
    production_date: string | null;
    expiry_date: string | null;
    lot_no: string | null;
    pallet_id: string | null;
    notes: string | null;
  }],
  metadata: {
    total_count: number;
    total_in: number;           // Sum of positive quantities
    total_out: number;          // Sum of negative quantities
    net_movement: number;       // total_in + total_out
  }
}
```

---

#### 1.3 Stock Availability Forecast
```
GET /api/ai/stock/forecast
```

**Purpose**: Production planning forecast with demand analysis

**Parameters**:
```typescript
{
  sku_id?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  sub_category?: string;
  days_of_supply_max?: number;  // Filter by DOS
  search?: string;
  page?: number;
  pageSize?: number;
}
```

**Response**:
```typescript
{
  data: [{
    sku_id: string;
    sku_name: string;
    category: string;
    sub_category: string;
    total_stock: number;
    avg_daily_ship: number;      // EWMA + Trimmed Mean + Median
    days_of_supply: number;      // Stock / avg_daily_ship
    pending_order_qty: number;   // Orders not yet loaded
    adjusted_days_of_supply: number;
    ship_trend: 'increasing' | 'stable' | 'decreasing';
    trend_slope: number;         // Sen's Slope
    confidence_level: 'high' | 'medium' | 'low';
    safety_stock: number;
    calculated_safety_stock: number;
    suggested_production: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    priority_score: number;      // 1-10 scale
    days_until_stockout: number;
    last_ship_date: string | null;
  }],
  summary: {
    totalSKUs: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgDaysOfSupply: number;
  }
}
```

**Statistical Methods Used**:
- EWMA (Exponential Weighted Moving Average)
- Trimmed Mean (remove outliers)
- Median (robust estimator)
- Mann-Kendall Test (trend significance)
- Sen's Slope (trend rate)
- Z-score for safety stock

---

### DOMAIN 2: WAREHOUSE & LOCATIONS

#### 2.1 Location Information
```
GET /api/ai/warehouse/locations
```

**Purpose**: Query warehouse location details and capacity

**Parameters**:
```typescript
{
  warehouse_id?: string;
  zone?: string;
  location_type?: 'STORAGE' | 'DISPATCH' | 'RECEIVING' | 'PRODUCTION';
  search?: string;
  available_only?: boolean;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    location_id: string;
    location_code: string;
    location_name: string;
    warehouse_name: string;
    zone: string;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    bin: string | null;
    location_type: string;
    is_active: boolean;
    current_weight: number;      // Calculated from balances
    max_weight: number;
    current_capacity_pct: number; // (current_weight / max_weight) * 100
    total_skus: number;          // Count of unique SKUs
    total_quantity: number;      // Sum of all stock
    last_movement: string | null;
  }],
  metadata: {
    total_locations: number;
    active_locations: number;
    occupied_locations: number;
    avg_capacity_pct: number;
  }
}
```

---

#### 2.2 Warehouse Utilization
```
GET /api/ai/warehouse/utilization
```

**Purpose**: Warehouse capacity and utilization metrics

**Response**:
```typescript
{
  data: [{
    warehouse_id: string;
    warehouse_name: string;
    total_locations: number;
    occupied_locations: number;
    occupation_rate: number;     // %
    total_weight_capacity: number;
    current_weight: number;
    weight_utilization: number;  // %
    by_zone: [{
      zone: string;
      locations: number;
      occupied: number;
      occupation_rate: number;
      avg_weight_pct: number;
    }]
  }],
  summary: {
    overall_occupation: number;
    overall_weight_utilization: number;
    hotspot_zones: string[];     // Zones >90% occupied
    underutilized_zones: string[]; // Zones <30% occupied
  }
}
```

---

### DOMAIN 3: ORDERS & FULFILLMENT

#### 3.1 Order Status Query
```
GET /api/ai/orders/status
```

**Purpose**: Track order lifecycle and status

**Parameters**:
```typescript
{
  order_code?: string;
  customer_code?: string;
  order_type?: 'express' | 'special' | 'general';
  status?: 'draft' | 'confirmed' | 'in_picking' | 'picked' | 'loaded' | 'in_transit' | 'delivered';
  date_from?: string;
  date_to?: string;
  employee_id?: number;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    order_id: number;
    order_code: string;
    customer_code: string;
    customer_name: string;
    order_type: string;
    status: string;
    status_thai: string;         // Thai translation
    total_items: number;
    total_quantity: number;
    picked_quantity: number;
    pending_quantity: number;
    order_date: string;
    due_date: string | null;
    assigned_employee: string | null;
    assigned_vehicle: string | null;
    assigned_route: string | null;
    current_location: string;    // Where order/items currently are
    estimated_delivery: string | null;
    created_at: string;
    updated_at: string;
  }],
  status_breakdown: {
    draft: number;
    confirmed: number;
    in_picking: number;
    picked: number;
    loaded: number;
    in_transit: number;
    delivered: number;
  }
}
```

---

#### 3.2 Picklist Information
```
GET /api/ai/picklists
```

**Purpose**: Picking operations and progress

**Parameters**:
```typescript
{
  picklist_id?: number;
  status?: 'pending' | 'assigned' | 'picking' | 'completed';
  employee_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    picklist_id: number;
    picklist_code: string;
    status: string;
    assigned_employee_name: string | null;
    total_items: number;
    picked_items: number;
    pending_items: number;
    completion_pct: number;      // (picked_items / total_items) * 100
    created_at: string;
    assigned_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    time_to_complete_minutes: number | null;
    items: [{
      sku_id: string;
      sku_name: string;
      source_location: string;
      quantity_to_pick: number;
      quantity_picked: number;
      status: 'pending' | 'picked';
    }]
  }],
  performance_metrics: {
    avg_pick_time_minutes: number;
    total_picks_today: number;
    on_time_completion_rate: number;
  }
}
```

---

### DOMAIN 4: RECEIVING & INBOUND

#### 4.1 Receiving Orders
```
GET /api/ai/receiving/orders
```

**Purpose**: Track inbound goods and receiving status

**Parameters**:
```typescript
{
  receive_no?: string;
  supplier_code?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    receive_id: number;
    receive_no: string;
    supplier_code: string;
    supplier_name: string;
    status: string;
    total_items: number;
    total_quantity_expected: number;
    total_quantity_received: number;
    completion_pct: number;
    receive_date: string;
    warehouse_name: string;
    receiver_employee: string | null;
    created_at: string;
    completed_at: string | null;
  }],
  summary: {
    pending_count: number;
    in_progress_count: number;
    completed_today: number;
  }
}
```

---

### DOMAIN 5: PRODUCTION

#### 5.1 Production Orders
```
GET /api/ai/production/orders
```

**Purpose**: Track production planning and execution

**Parameters**:
```typescript
{
  po_code?: string;
  status?: 'draft' | 'approved' | 'in_production' | 'completed' | 'cancelled';
  date_from?: string;
  date_to?: string;
  finished_sku_id?: string;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    po_id: number;
    po_code: string;
    finished_sku_id: string;
    finished_sku_name: string;
    target_quantity: number;
    produced_quantity: number;
    status: string;
    production_date: string;
    due_date: string | null;
    material_requirements: [{
      material_sku_id: string;
      material_sku_name: string;
      required_qty: number;
      available_qty: number;
      shortage: number;          // If < 0
    }],
    completion_pct: number;
    created_at: string;
  }],
  summary: {
    total_orders: number;
    in_production: number;
    material_shortages: number;
  }
}
```

---

#### 5.2 BOM (Bill of Materials)
```
GET /api/ai/production/bom
```

**Purpose**: Material requirements for production

**Parameters**:
```typescript
{
  bom_id?: string;
  finished_sku_id?: string;
  material_sku_id?: string;
  is_active?: boolean;
}
```

**Response**:
```typescript
{
  data: [{
    bom_id: string;
    finished_sku_id: string;
    finished_sku_name: string;
    finished_qty_per_pack: number;
    materials: [{
      material_sku_id: string;
      material_sku_name: string;
      quantity_required: number;
      unit: string;
      current_stock: number;      // From inventory
      shortfall: number;          // If current_stock < quantity_required
    }],
    total_materials: number;
    is_active: boolean;
  }]
}
```

---

### DOMAIN 6: VEHICLES & ROUTES

#### 6.1 Route Plans
```
GET /api/ai/routes
```

**Purpose**: Delivery route information and optimization

**Parameters**:
```typescript
{
  route_id?: number;
  status?: 'draft' | 'published' | 'ready_to_load' | 'in_transit' | 'completed';
  vehicle_id?: string;
  driver_id?: number;
  date?: string;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    route_id: number;
    route_name: string;
    status: string;
    vehicle_code: string;
    driver_name: string | null;
    total_trips: number;
    total_orders: number;
    total_distance_km: number;
    estimated_duration_hours: number;
    route_date: string;
    trips: [{
      trip_id: number;
      trip_sequence: number;
      customer_name: string;
      location: string;
      distance_from_prev_km: number;
      estimated_arrival: string;
      delivery_status: string;
    }]
  }],
  summary: {
    total_routes_today: number;
    completed_routes: number;
    in_transit_routes: number;
  }
}
```

---

### DOMAIN 7: EMPLOYEES & PERFORMANCE

#### 7.1 Employee Activity
```
GET /api/ai/employees/activity
```

**Purpose**: Track employee operations and productivity

**Parameters**:
```typescript
{
  employee_id?: number;
  department?: string;
  date_from?: string;
  date_to?: string;
  activity_type?: 'picking' | 'receiving' | 'loading' | 'checking';
}
```

**Response**:
```typescript
{
  data: [{
    employee_id: number;
    employee_code: string;
    employee_name: string;
    department: string;
    activities: [{
      activity_type: string;
      count: number;
      avg_time_minutes: number;
      total_quantity_handled: number;
    }],
    total_picks_today: number;
    total_receives_today: number;
    efficiency_score: number;    // Compared to average
  }]
}
```

---

### DOMAIN 8: AUDIT & LOGS

#### 8.1 Inventory Ledger
```
GET /api/ai/audit/ledger
```

**Purpose**: Complete audit trail of all inventory movements

**Parameters**:
```typescript
{
  sku_id?: string;
  location_id?: string;
  date_from?: string;
  date_to?: string;
  transaction_type?: string;
  order_id?: number;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    ledger_id: number;
    transaction_type: 'IN' | 'OUT' | 'ADJUST';
    sku_id: string;
    sku_name: string;
    location_code: string;
    quantity: number;
    balance_before: number;
    balance_after: number;
    reference_doc_no: string;
    reference_doc_type: string;
    order_id: number | null;
    created_by: string | null;
    created_at: string;
    production_date: string | null;
    expiry_date: string | null;
    lot_no: string | null;
    pallet_id: string | null;
  }],
  reconciliation: {
    total_in: number;
    total_out: number;
    net_balance: number;
  }
}
```

---

#### 8.2 System Alerts
```
GET /api/ai/audit/alerts
```

**Purpose**: Exception monitoring and alerts

**Parameters**:
```typescript
{
  alert_type?: 'stock_low' | 'stock_out' | 'expiry_warning' | 'location_full';
  severity?: 'critical' | 'warning' | 'info';
  date_from?: string;
  date_to?: string;
  resolved?: boolean;
}
```

**Response**:
```typescript
{
  data: [{
    alert_id: number;
    alert_type: string;
    severity: string;
    message: string;
    message_thai: string;
    sku_id: string | null;
    location_id: string | null;
    current_value: number;
    threshold_value: number;
    created_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
  }],
  summary: {
    critical_count: number;
    warning_count: number;
    unresolved_count: number;
  }
}
```

---

### DOMAIN 9: KPI & ANALYTICS

#### 9.1 Warehouse KPIs
```
GET /api/ai/analytics/kpi
```

**Purpose**: Key performance indicators for warehouse operations

**Parameters**:
```typescript
{
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  kpi_type?: 'efficiency' | 'accuracy' | 'utilization' | 'throughput';
}
```

**Response**:
```typescript
{
  data: {
    efficiency: {
      avg_pick_time_minutes: number;
      avg_receive_time_minutes: number;
      avg_loading_time_minutes: number;
      picks_per_hour: number;
      receives_per_hour: number;
    },
    accuracy: {
      pick_accuracy_rate: number;    // %
      inventory_accuracy_rate: number;
      order_fulfillment_rate: number;
    },
    utilization: {
      warehouse_space_utilization: number;
      labor_utilization: number;
      vehicle_utilization: number;
    },
    throughput: {
      total_items_received: number;
      total_items_picked: number;
      total_items_shipped: number;
      total_orders_fulfilled: number;
    },
    financial: {
      inventory_turnover_ratio: number;
      days_inventory_on_hand: number;
      stock_value: number;         // Total stock value
    }
  },
  trends: {
    efficiency_trend: 'improving' | 'stable' | 'declining';
    accuracy_trend: 'improving' | 'stable' | 'declining';
    throughput_trend: 'increasing' | 'stable' | 'decreasing';
  }
}
```

---

### DOMAIN 10: MASTER DATA

#### 10.1 SKU Master Data
```
GET /api/ai/master/sku
```

**Purpose**: Product/SKU information

**Parameters**:
```typescript
{
  sku_id?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  is_active?: boolean;
  search?: string;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    sku_id: string;
    sku_name: string;
    sku_name_thai: string;
    category: string;
    sub_category: string;
    brand: string;
    unit: string;
    qty_per_pack: number;
    weight_per_unit: number;
    volume_per_unit: number;
    safety_stock: number;
    reorder_point: number;
    is_active: boolean;
    current_stock: number;       // From inventory balances
    stock_value: number;         // qty * cost
  }]
}
```

---

#### 10.2 Customer Information
```
GET /api/ai/master/customers
```

**Purpose**: Customer details and order history

**Parameters**:
```typescript
{
  customer_code?: string;
  search?: string;
  has_pending_orders?: boolean;
  limit?: number;
}
```

**Response**:
```typescript
{
  data: [{
    customer_code: string;
    customer_name: string;
    contact_person: string;
    phone: string;
    address: string;
    district: string;
    province: string;
    postal_code: string;
    total_orders: number;
    pending_orders: number;
    last_order_date: string | null;
    credit_limit: number;
    current_debt: number;
  }]
}
```

---

## API ENDPOINT SUMMARY

**Total Required APIs**: 20+ endpoints

### Master Data (3)
- GET /api/ai/master/sku
- GET /api/ai/master/customers
- GET /api/ai/master/suppliers

### Stock & Inventory (3)
- GET /api/ai/stock/balance
- GET /api/ai/stock/movements
- GET /api/ai/stock/forecast

### Warehouse & Locations (2)
- GET /api/ai/warehouse/locations
- GET /api/ai/warehouse/utilization

### Orders & Fulfillment (2)
- GET /api/ai/orders/status
- GET /api/ai/picklists

### Receiving (1)
- GET /api/ai/receiving/orders

### Production (2)
- GET /api/ai/production/orders
- GET /api/ai/production/bom

### Vehicles & Routes (1)
- GET /api/ai/routes

### Employees (1)
- GET /api/ai/employees/activity

### Audit & Logs (2)
- GET /api/ai/audit/ledger
- GET /api/ai/audit/alerts

### Analytics (1)
- GET /api/ai/analytics/kpi

---

## IMPLEMENTATION STRATEGY

### Phase 3.1: Core APIs (Priority)
1. Stock balance
2. Order status
3. Location information
4. Stock movements
5. KPI summary

### Phase 3.2: Operational APIs
6. Picklists
7. Receiving orders
8. Production orders
9. Routes
10. Employee activity

### Phase 3.3: Advanced APIs
11. Forecast
12. BOM
13. Warehouse utilization
14. Audit ledger
15. Alerts

### Phase 3.4: Supplementary APIs
16-20. Master data, customers, suppliers, etc.

---

## SECURITY & PERMISSIONS

### API Access Control
```typescript
// Middleware for AI API routes
export async function validateAIApiAccess(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false, error: 'Unauthorized' };
  }

  // Check user has AI access permission
  const { data: permissions } = await supabase
    .from('user_permissions')
    .select('can_use_ai')
    .eq('user_id', user.id)
    .single();

  if (!permissions?.can_use_ai) {
    return { authorized: false, error: 'AI access not permitted' };
  }

  return { authorized: true, user };
}
```

### Rate Limiting
- Max 60 requests per minute per user
- Max 1000 requests per hour per user
- Prevents API abuse

### Data Filtering
- Users only see data for their warehouses
- RLS (Row Level Security) enforced
- Sensitive data (costs, margins) filtered based on role

---

## ERROR HANDLING

### Standard Error Response
```typescript
{
  error: true,
  message: string;           // English
  message_thai: string;      // Thai
  code: string;              // ERROR_CODE
  details?: any;
  timestamp: string;
}
```

### Error Codes
- `AUTH_REQUIRED`: Not authenticated
- `PERMISSION_DENIED`: No access to this resource
- `INVALID_PARAMS`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT`: Too many requests
- `SERVER_ERROR`: Internal server error

---

## NEXT STEPS

1. Implement core APIs (Phase 3.1)
2. Test each API with actual database
3. Create API documentation
4. Build LLM integration layer (Phase 4)
5. Add caching for performance
6. Monitor API usage and optimize

---

**STATUS**: SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION

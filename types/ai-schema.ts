/**
 * AI API TypeScript Types
 * Types for AI Chat and API responses
 */

// ============================================
// Chat Types
// ============================================

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  error?: boolean;
  tool_calls?: AIToolCall[];
  tool_results?: AIToolResult[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AIToolResult {
  tool_call_id: string;
  name: string;
  result: any;
  error?: string;
}

export interface AIChatRequest {
  message: string;
  conversation_history?: AIChatMessage[];
  session_id?: string;
  user_id?: string;
}

export interface AIChatResponse {
  success: boolean;
  message: string;
  tool_calls?: AIToolCall[];
  tool_results?: AIToolResult[];
  data?: any;
  error?: string;
  timestamp: string;
}

// ============================================
// Stock Balance API Types
// ============================================

export interface AIStockBalanceParams {
  sku_id?: string;
  location_id?: string;
  warehouse_id?: string;
  zone?: string;
  include_reserved?: boolean;
  include_expired?: boolean;
  limit?: number;
}

export interface AIStockBalanceItem {
  sku_id: string;
  sku_name: string;
  location_id: string;
  location_name: string;
  warehouse_id: string;
  warehouse_name: string;
  zone: string | null;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  total_piece_qty: number;
  reserved_piece_qty: number;
  available_piece_qty: number;
  total_pack_qty: number;
  is_expired: boolean;
}

export interface AIStockBalanceSummary {
  total_items: number;
  total_piece_qty: number;
  total_reserved_qty: number;
  total_available_qty: number;
  unique_skus: number;
  unique_locations: number;
}

export interface AIStockBalanceResponse {
  success: boolean;
  data: AIStockBalanceItem[];
  summary: AIStockBalanceSummary;
  query_params: AIStockBalanceParams;
  timestamp: string;
  error?: string;
}

// ============================================
// Order Status API Types
// ============================================

export interface AIOrderStatusParams {
  order_code?: string;
  order_id?: number;
  customer_code?: string;
  order_type?: 'express' | 'special' | 'general';
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIOrderItem {
  sku_id: string;
  sku_name: string;
  order_qty: number;
  picked_qty: number;
  shipped_qty: number;
  unit_price: number;
}

export interface AIOrderStatus {
  order_id: number;
  order_no: string;
  order_type: string;
  status: string;
  status_thai: string;
  customer_id: string;
  customer_name: string;
  shop_name: string | null;
  province: string | null;
  order_date: string;
  delivery_date: string | null;
  total_amount: number;
  total_items: number;
  total_qty: number;
  picked_qty: number;
  shipped_qty: number;
  pick_progress_percent: number;
  ship_progress_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: AIOrderItem[];
}

export interface AIOrderStatusSummary {
  total_orders: number;
  by_status: Record<string, number>;
  total_amount: number;
  avg_pick_progress: number;
}

export interface AIOrderStatusResponse {
  success: boolean;
  data: AIOrderStatus[];
  summary: AIOrderStatusSummary;
  query_params: AIOrderStatusParams;
  timestamp: string;
  error?: string;
}

// ============================================
// Warehouse Locations API Types
// ============================================

export interface AIWarehouseLocationParams {
  warehouse_id?: string;
  zone?: string;
  location_type?: 'rack' | 'floor' | 'bulk' | 'other';
  search?: string;
  available_only?: boolean;
  limit?: number;
}

export interface AIWarehouseLocation {
  location_id: string;
  location_code: string;
  location_name: string;
  warehouse_id: string;
  warehouse_name: string;
  location_type: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  max_capacity_qty: number;
  current_qty: number;
  available_qty: number;
  utilization_percent: number;
  max_capacity_weight_kg: number;
  current_weight_kg: number;
  temperature_controlled: boolean;
  humidity_controlled: boolean;
  active_status: string;
  sku_count: number;
  pallet_count: number;
}

export interface AIWarehouseLocationSummary {
  total_locations: number;
  active_locations: number;
  total_capacity: number;
  total_used: number;
  avg_utilization_percent: number;
  by_zone: Record<string, { count: number; utilization: number }>;
  by_type: Record<string, number>;
}

export interface AIWarehouseLocationResponse {
  success: boolean;
  data: AIWarehouseLocation[];
  summary: AIWarehouseLocationSummary;
  query_params: AIWarehouseLocationParams;
  timestamp: string;
  error?: string;
}

// ============================================
// Stock Movements API Types
// ============================================

export interface AIStockMovementParams {
  sku_id?: string;
  location_id?: string;
  warehouse_id?: string;
  movement_type?: 'receive' | 'ship' | 'transfer' | 'putaway' | 'replenishment' | 'adjustment';
  direction?: 'in' | 'out';
  date_from?: string;
  date_to?: string;
  reference_no?: string;
  limit?: number;
}

export interface AIStockMovement {
  ledger_id: number;
  movement_at: string;
  transaction_type: string;
  transaction_type_thai: string;
  direction: string;
  direction_thai: string;
  warehouse_id: string;
  warehouse_name: string;
  location_id: string;
  location_name: string;
  sku_id: string;
  sku_name: string;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  pack_qty: number;
  piece_qty: number;
  reference_no: string | null;
  order_id: number | null;
  order_no: string | null;
  remarks: string | null;
  created_by: number | null;
  created_by_name: string | null;
}

export interface AIStockMovementSummary {
  total_movements: number;
  total_in_qty: number;
  total_out_qty: number;
  net_qty: number;
  by_type: Record<string, { count: number; qty: number }>;
  by_date: Record<string, { in_qty: number; out_qty: number }>;
}

export interface AIStockMovementResponse {
  success: boolean;
  data: AIStockMovement[];
  summary: AIStockMovementSummary;
  query_params: AIStockMovementParams;
  timestamp: string;
  error?: string;
}

// ============================================
// KPI Analytics API Types
// ============================================

export interface AIKPIParams {
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  kpi_type?: 'efficiency' | 'accuracy' | 'utilization' | 'throughput' | 'all';
}

export interface AIKPIThroughput {
  total_received_qty: number;
  total_shipped_qty: number;
  total_movements: number;
  avg_daily_received: number;
  avg_daily_shipped: number;
  receiving_orders_count: number;
  shipping_orders_count: number;
}

export interface AIKPIEfficiency {
  orders_completed: number;
  orders_pending: number;
  orders_in_progress: number;
  completion_rate_percent: number;
  avg_order_processing_days: number;
  picking_completion_rate: number;
}

export interface AIKPIUtilization {
  total_locations: number;
  occupied_locations: number;
  location_utilization_percent: number;
  total_capacity_qty: number;
  current_stock_qty: number;
  capacity_utilization_percent: number;
  unique_skus_in_stock: number;
  unique_pallets: number;
}

export interface AIKPIInventory {
  total_stock_value: number;
  total_piece_qty: number;
  total_reserved_qty: number;
  available_qty: number;
  expiring_soon_qty: number;
  expired_qty: number;
  low_stock_skus: number;
}

export interface AIKPIPeriod {
  date_from: string;
  date_to: string;
  days_in_period: number;
}

export interface AIKPIData {
  throughput: AIKPIThroughput;
  efficiency: AIKPIEfficiency;
  utilization: AIKPIUtilization;
  inventory: AIKPIInventory;
  period: AIKPIPeriod;
}

export interface AIKPIResponse {
  success: boolean;
  data: AIKPIData;
  query_params: AIKPIParams;
  timestamp: string;
  error?: string;
}

// ============================================
// Tool Definitions
// ============================================

export type AIToolName =
  // Existing tools
  | 'query_stock_balance'
  | 'query_stock_movements'
  | 'query_forecast'
  | 'query_warehouse_locations'
  | 'query_warehouse_utilization'
  | 'query_order_status'
  | 'query_picklists'
  | 'query_receiving_orders'
  | 'query_production_orders'
  | 'query_bom'
  | 'query_routes'
  | 'query_employee_activity'
  | 'query_inventory_ledger'
  | 'query_system_alerts'
  | 'query_kpi'
  | 'query_sku_master'
  | 'query_customers'
  // New tools - Phase B Enhancement
  | 'query_transfers'
  | 'query_stock_adjustments'
  | 'query_face_sheets'
  | 'query_bonus_face_sheets'
  | 'query_loadlists'
  | 'query_replenishment'
  | 'query_production_plan'
  | 'query_material_issues'
  | 'query_suppliers'
  | 'query_vehicles'
  | 'query_preparation_areas';

export interface AIToolDefinition {
  name: AIToolName;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// ============================================
// New API Types - Phase B Enhancement
// ============================================

// Transfer Types
export interface AITransferParams {
  move_id?: number;
  move_no?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  from_location_id?: string;
  to_location_id?: string;
  sku_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AITransferItem {
  move_id: number;
  move_no: string;
  status: string;
  status_thai: string;
  from_location_id: string;
  from_location_name: string;
  to_location_id: string;
  to_location_name: string;
  sku_id: string;
  sku_name: string;
  quantity: number;
  created_at: string;
  completed_at: string | null;
  created_by_name: string | null;
}

export interface AITransferSummary {
  total_transfers: number;
  by_status: Record<string, number>;
  total_qty: number;
}

export interface AITransferResponse {
  success: boolean;
  data: AITransferItem[];
  summary: AITransferSummary;
  query_params: AITransferParams;
  timestamp: string;
  error?: string;
}

// Stock Adjustment Types
export interface AIStockAdjustmentParams {
  adjustment_id?: number;
  adjustment_no?: string;
  status?: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed';
  adjustment_type?: 'increase' | 'decrease' | 'damage' | 'expired' | 'count';
  sku_id?: string;
  location_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIStockAdjustmentItem {
  adjustment_id: number;
  adjustment_no: string;
  status: string;
  status_thai: string;
  adjustment_type: string;
  adjustment_type_thai: string;
  sku_id: string;
  sku_name: string;
  location_id: string;
  location_name: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  approved_at: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
}

export interface AIStockAdjustmentSummary {
  total_adjustments: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  total_increase_qty: number;
  total_decrease_qty: number;
}

export interface AIStockAdjustmentResponse {
  success: boolean;
  data: AIStockAdjustmentItem[];
  summary: AIStockAdjustmentSummary;
  query_params: AIStockAdjustmentParams;
  timestamp: string;
  error?: string;
}

// Face Sheet Types
export interface AIFaceSheetParams {
  face_sheet_id?: number;
  face_sheet_no?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  picklist_id?: number;
  order_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIFaceSheetItem {
  face_sheet_id: number;
  face_sheet_no: string;
  status: string;
  status_thai: string;
  picklist_id: number;
  order_id: number;
  order_no: string;
  customer_name: string;
  total_packages: number;
  total_items: number;
  total_qty: number;
  created_at: string;
  completed_at: string | null;
}

export interface AIFaceSheetSummary {
  total_face_sheets: number;
  by_status: Record<string, number>;
  total_packages: number;
  total_qty: number;
}

export interface AIFaceSheetResponse {
  success: boolean;
  data: AIFaceSheetItem[];
  summary: AIFaceSheetSummary;
  query_params: AIFaceSheetParams;
  timestamp: string;
  error?: string;
}

// Loadlist Types
export interface AILoadlistParams {
  loadlist_id?: number;
  loadlist_no?: string;
  status?: 'draft' | 'ready' | 'loading' | 'loaded' | 'departed';
  vehicle_id?: number;
  route_plan_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AILoadlistItem {
  loadlist_id: number;
  loadlist_no: string;
  status: string;
  status_thai: string;
  vehicle_id: number | null;
  vehicle_plate: string | null;
  driver_name: string | null;
  route_plan_id: number | null;
  total_orders: number;
  total_packages: number;
  total_qty: number;
  loading_door: string | null;
  created_at: string;
  departed_at: string | null;
}

export interface AILoadlistSummary {
  total_loadlists: number;
  by_status: Record<string, number>;
  total_orders: number;
  total_packages: number;
}

export interface AILoadlistResponse {
  success: boolean;
  data: AILoadlistItem[];
  summary: AILoadlistSummary;
  query_params: AILoadlistParams;
  timestamp: string;
  error?: string;
}

// Replenishment Types
export interface AIReplenishmentParams {
  queue_id?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sku_id?: string;
  from_location_id?: string;
  to_location_id?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  limit?: number;
}

export interface AIReplenishmentItem {
  queue_id: number;
  status: string;
  status_thai: string;
  priority: string;
  priority_thai: string;
  sku_id: string;
  sku_name: string;
  from_location_id: string;
  from_location_name: string;
  to_location_id: string;
  to_location_name: string;
  requested_qty: number;
  completed_qty: number;
  pallet_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIReplenishmentSummary {
  total_queue: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  total_requested_qty: number;
  total_completed_qty: number;
}

export interface AIReplenishmentResponse {
  success: boolean;
  data: AIReplenishmentItem[];
  summary: AIReplenishmentSummary;
  query_params: AIReplenishmentParams;
  timestamp: string;
  error?: string;
}

// Production Plan Types
export interface AIProductionPlanParams {
  plan_id?: number;
  status?: 'draft' | 'approved' | 'in_progress' | 'completed';
  sku_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIProductionPlanItem {
  plan_id: number;
  plan_no: string;
  status: string;
  status_thai: string;
  sku_id: string;
  sku_name: string;
  planned_qty: number;
  actual_qty: number;
  plan_date: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface AIProductionPlanSummary {
  total_plans: number;
  by_status: Record<string, number>;
  total_planned_qty: number;
  total_actual_qty: number;
  completion_rate: number;
}

export interface AIProductionPlanResponse {
  success: boolean;
  data: AIProductionPlanItem[];
  summary: AIProductionPlanSummary;
  query_params: AIProductionPlanParams;
  timestamp: string;
  error?: string;
}

// Material Issue Types
export interface AIMaterialIssueParams {
  issue_id?: number;
  issue_no?: string;
  status?: 'draft' | 'pending' | 'issued' | 'cancelled';
  production_order_id?: number;
  sku_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface AIMaterialIssueItem {
  issue_id: number;
  issue_no: string;
  status: string;
  status_thai: string;
  production_order_id: number;
  production_no: string;
  sku_id: string;
  sku_name: string;
  requested_qty: number;
  issued_qty: number;
  location_id: string;
  location_name: string;
  created_at: string;
  issued_at: string | null;
}

export interface AIMaterialIssueSummary {
  total_issues: number;
  by_status: Record<string, number>;
  total_requested_qty: number;
  total_issued_qty: number;
}

export interface AIMaterialIssueResponse {
  success: boolean;
  data: AIMaterialIssueItem[];
  summary: AIMaterialIssueSummary;
  query_params: AIMaterialIssueParams;
  timestamp: string;
  error?: string;
}

// Supplier Types
export interface AISupplierParams {
  supplier_id?: string;
  supplier_name?: string;
  is_active?: boolean;
  limit?: number;
}

export interface AISupplierItem {
  supplier_id: string;
  supplier_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  total_receives: number;
  last_receive_date: string | null;
}

export interface AISupplierSummary {
  total_suppliers: number;
  active_suppliers: number;
}

export interface AISupplierResponse {
  success: boolean;
  data: AISupplierItem[];
  summary: AISupplierSummary;
  query_params: AISupplierParams;
  timestamp: string;
  error?: string;
}

// Vehicle Types
export interface AIVehicleParams {
  vehicle_id?: number;
  plate_number?: string;
  status?: 'available' | 'in_use' | 'maintenance';
  vehicle_type?: string;
  supplier_id?: string;
  limit?: number;
}

export interface AIVehicleItem {
  vehicle_id: number;
  plate_number: string;
  vehicle_type: string;
  vehicle_type_thai: string;
  status: string;
  status_thai: string;
  capacity_kg: number | null;
  capacity_cbm: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  current_route: string | null;
  last_trip_date: string | null;
}

export interface AIVehicleSummary {
  total_vehicles: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

export interface AIVehicleResponse {
  success: boolean;
  data: AIVehicleItem[];
  summary: AIVehicleSummary;
  query_params: AIVehicleParams;
  timestamp: string;
  error?: string;
}

// Preparation Area Types
export interface AIPreparationAreaParams {
  area_id?: number;
  area_code?: string;
  is_active?: boolean;
  limit?: number;
}

export interface AIPreparationAreaItem {
  area_id: number;
  area_code: string;
  area_name: string;
  description: string | null;
  is_active: boolean;
  total_locations: number;
  current_stock_qty: number;
  assigned_skus: number;
}

export interface AIPreparationAreaSummary {
  total_areas: number;
  active_areas: number;
  total_stock_qty: number;
}

export interface AIPreparationAreaResponse {
  success: boolean;
  data: AIPreparationAreaItem[];
  summary: AIPreparationAreaSummary;
  query_params: AIPreparationAreaParams;
  timestamp: string;
  error?: string;
}

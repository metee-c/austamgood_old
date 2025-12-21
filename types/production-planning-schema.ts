/**
 * Production Planning Types
 * ประเภทข้อมูลสำหรับระบบวางแผนการผลิต
 */

// ========== Enums ==========
export type ProductionPlanStatus = 'draft' | 'approved' | 'in_production' | 'completed' | 'cancelled';
export type ProductionOrderStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type MaterialRequirementStatus = 'needed' | 'ordered' | 'received' | 'allocated' | 'cancelled';

// ========== Production Plan (Header) ==========
export interface ProductionPlan {
  plan_id: string;
  plan_no: string;
  plan_name: string;
  plan_description?: string;
  plan_start_date: string;
  plan_end_date: string;
  warehouse_id?: string;
  production_area_id?: string;
  priority: number;
  status: ProductionPlanStatus;
  total_products_planned: number;
  total_materials_required: number;
  total_shortage_items: number;
  created_by?: number;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// User info for creator/approver (from master_employee)
export interface PlanUserInfo {
  employee_id: number;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

export interface ProductionPlanWithItems extends ProductionPlan {
  items: ProductionPlanItem[];
  material_requirements?: MaterialRequirement[];
  creator?: PlanUserInfo;
  approver?: PlanUserInfo;
}

// ========== Production Plan Items ==========
export interface ProductionPlanItem {
  plan_item_id: string;
  plan_id: string;
  sku_id: string;
  required_qty: number;
  produced_qty: number;
  remaining_qty?: number;
  current_stock_qty: number;
  safety_stock_qty: number;
  net_requirement_qty?: number;
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status: ProductionOrderStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionPlanItemWithDetails extends ProductionPlanItem {
  sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
    category?: string;
    sub_category?: string;
    qty_per_pack?: number;
  };
  bom_materials?: BomMaterial[];
}

// ========== Material Requirements ==========
export interface MaterialRequirement {
  requirement_id: string;
  plan_id: string;
  plan_item_id?: string;
  material_sku_id: string;
  finished_sku_id: string;
  bom_id?: string;
  material_qty_per_unit: number;
  waste_qty_per_unit: number;
  production_qty: number;
  gross_requirement: number;
  current_stock: number;
  allocated_stock: number;
  available_stock?: number;
  net_requirement?: number;
  shortage_qty?: number;
  suggested_order_qty?: number;
  supplier_id?: string;
  lead_time_days: number;
  required_date?: string;
  status: MaterialRequirementStatus;
  po_no?: string;
  po_qty?: number;
  po_date?: string;
  calculated_at: string;
  updated_at: string;
  material_uom?: string;
}

export interface MaterialRequirementWithDetails extends MaterialRequirement {
  material_sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
  };
  finished_sku?: {
    sku_id: string;
    sku_name: string;
  };
}

// ========== BOM Material (for calculation) ==========
export interface BomMaterial {
  id: number;
  bom_id: string;
  material_sku_id: string;
  material_name: string;
  material_qty: number;
  material_uom: string;
  waste_qty: number;
  step_order: number;
  step_name?: string;
  // Calculated fields
  total_required?: number;
  current_stock?: number;
  available_stock?: number;
  shortage?: number;
  // Selection state (for UI)
  selected?: boolean;
}

// ========== Input Types ==========
export interface CreateProductionPlanInput {
  plan_name: string;
  plan_description?: string;
  plan_start_date: string;
  plan_end_date: string;
  warehouse_id?: string;
  production_area_id?: string;
  priority?: number;
  items: CreateProductionPlanItemInput[];
}

export interface CreateProductionPlanItemInput {
  sku_id: string;
  required_qty: number;
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  notes?: string;
  // BOM materials to include (selected by user)
  selected_materials?: SelectedMaterial[];
}

export interface SelectedMaterial {
  bom_id: string;
  material_sku_id: string;
  include: boolean;
}

export interface UpdateProductionPlanInput {
  plan_id: string;
  plan_name?: string;
  plan_description?: string;
  plan_start_date?: string;
  plan_end_date?: string;
  warehouse_id?: string;
  production_area_id?: string;
  priority?: number;
  status?: ProductionPlanStatus;
}

export interface UpdateProductionPlanItemInput {
  plan_item_id: string;
  required_qty?: number;
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  status?: ProductionOrderStatus;
  notes?: string;
}

// ========== BOM Calculation Types ==========
export interface BomCalculationRequest {
  sku_id: string;
  quantity: number;
}

export interface BomCalculationResult {
  sku_id: string;
  sku_name: string;
  production_qty: number;
  bom_id?: string;
  materials: CalculatedMaterial[];
  total_materials_count: number;
  has_shortage: boolean;
  shortage_count: number;
}

export interface CalculatedMaterial {
  bom_id: string;
  material_sku_id: string;
  material_name: string;
  material_uom: string;
  qty_per_unit: number;
  waste_per_unit: number;
  step_order: number;
  step_name?: string;
  // Calculated
  gross_requirement: number;
  current_stock: number;
  allocated_stock: number;
  available_stock: number;
  net_requirement: number;
  shortage_qty: number;
  has_shortage: boolean;
}

// ========== Filter Types ==========
export interface ProductionPlanFilters {
  search?: string;
  status?: ProductionPlanStatus | 'all';
  start_date?: string;
  end_date?: string;
  warehouse_id?: string;
  priority?: number;
  page?: number;
  pageSize?: number;
}

// ========== Response Types ==========
export interface ProductionPlanListResponse {
  data: ProductionPlanWithItems[];
  totalCount: number;
  summary: {
    total: number;
    draft: number;
    approved: number;
    in_production: number;
    completed: number;
    cancelled: number;
  };
}

export interface ProductionPlanResponse {
  data: ProductionPlanWithItems | null;
  error: string | null;
}

export interface BomCalculationResponse {
  data: BomCalculationResult | null;
  error: string | null;
}

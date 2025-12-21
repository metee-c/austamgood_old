/**
 * Production Order Types
 * ประเภทข้อมูลสำหรับระบบใบสั่งผลิต
 */

// ========== Enums ==========
export type ProductionOrderStatus = 'planned' | 'released' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type ProductionItemStatus = 'pending' | 'partial' | 'issued' | 'returned';

// ========== Production Order (Header) ==========
export interface ProductionOrder {
  id: string;
  production_no: string;
  plan_id?: string;
  sku_id: string;
  quantity: number;
  produced_qty: number;
  remaining_qty?: number;
  uom?: string;
  start_date: string;
  due_date: string;
  actual_start_date?: string;
  actual_completion_date?: string;
  status: ProductionOrderStatus;
  priority: number;
  remarks?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// User info for creator (from master_employee)
export interface OrderUserInfo {
  employee_id: number;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

export interface ProductionOrderWithDetails extends ProductionOrder {
  items?: ProductionOrderItemWithDetails[];
  sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
    category?: string;
    sub_category?: string;
  };
  plan?: {
    plan_id: string;
    plan_no: string;
    plan_name: string;
  };
  creator?: OrderUserInfo;
}

// ========== Production Order Items (Materials) ==========
export interface ProductionOrderItem {
  id: string;
  production_order_id: string;
  material_sku_id: string;
  required_qty: number;
  issued_qty: number;
  remaining_qty?: number;
  uom?: string;
  status: ProductionItemStatus;
  issued_date?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionOrderItemWithDetails extends ProductionOrderItem {
  material_sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
  };
}

// ========== Input Types ==========
export interface CreateProductionOrderInput {
  plan_id?: string;
  sku_id: string;
  quantity: number;
  uom?: string;
  start_date: string;
  due_date: string;
  priority?: number;
  remarks?: string;
  items?: CreateProductionOrderItemInput[];
}

export interface CreateProductionOrderItemInput {
  material_sku_id: string;
  required_qty: number;
  uom?: string;
  remarks?: string;
}

export interface UpdateProductionOrderInput {
  id: string;
  quantity?: number;
  start_date?: string;
  due_date?: string;
  priority?: number;
  remarks?: string;
  status?: ProductionOrderStatus;
}

// ========== Filter Types ==========
export interface ProductionOrderFilters {
  search?: string;
  status?: ProductionOrderStatus | 'all';
  plan_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
}

// ========== Response Types ==========
export interface ProductionOrderListResponse {
  data: ProductionOrderWithDetails[];
  totalCount: number;
  summary: {
    total: number;
    planned: number;
    released: number;
    in_progress: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  };
}

export interface ProductionOrderResponse {
  data: ProductionOrderWithDetails | null;
  error: string | null;
}

// ========== Pre-fill Data from Plan ==========
export interface PlanDataForOrder {
  plan_id: string;
  plan_no: string;
  plan_name: string;
  plan_start_date: string;
  plan_end_date: string;
  items: {
    sku_id: string;
    sku_name: string;
    required_qty: number;
  }[];
  materials: {
    material_sku_id: string;
    material_name: string;
    gross_requirement: number;
    material_uom?: string;
  }[];
}

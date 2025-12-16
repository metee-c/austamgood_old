// Stock Adjustment Type Definitions and Zod Schemas
import { z } from 'zod';

// ============================================================================
// ENUMS AND TYPES
// ============================================================================

export type AdjustmentType = 'increase' | 'decrease';
export type AdjustmentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';

// ============================================================================
// DATABASE RECORD INTERFACES
// ============================================================================

export interface AdjustmentReason {
  reason_id: number;
  reason_code: string;
  reason_name_th: string;
  reason_name_en: string;
  reason_type: 'increase' | 'decrease' | 'both';
  requires_approval: boolean;
  active_status: 'active' | 'inactive';
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustment {
  adjustment_id: number;
  adjustment_no: string;
  adjustment_type: AdjustmentType;
  status: AdjustmentStatus;
  warehouse_id: string;
  reason_id: number;
  adjustment_date: string;
  reference_no?: string | null;
  remarks?: string | null;
  created_by?: number | null;
  approved_by?: number | null;
  approved_at?: string | null;
  completed_by?: number | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustmentItem {
  adjustment_item_id: number;
  adjustment_id: number;
  line_no: number;
  sku_id: string;
  location_id: string;
  pallet_id?: string | null;
  pallet_id_external?: string | null;
  lot_no?: string | null;
  production_date?: string | null;
  expiry_date?: string | null;
  before_pack_qty: number;
  before_piece_qty: number;
  adjustment_pack_qty: number;
  adjustment_piece_qty: number;
  after_pack_qty: number;
  after_piece_qty: number;
  ledger_id?: number | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

// Extended record with relations
export interface AdjustmentRecord extends StockAdjustment {
  reason?: AdjustmentReason | null;
  warehouse?: { warehouse_name: string | null } | null;
  created_by_user?: { full_name: string | null } | null;
  approved_by_user?: { full_name: string | null } | null;
  completed_by_user?: { full_name: string | null } | null;
  wms_stock_adjustment_items?: (StockAdjustmentItem & {
    master_sku?: { sku_name: string | null; barcode: string | null } | null;
    master_location?: { location_name: string | null; location_code: string | null } | null;
  })[];
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const createAdjustmentItemSchema = z.object({
  sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
  location_id: z.string().min(1, 'กรุณาเลือก Location'),
  pallet_id: z.string().optional().nullable(),
  pallet_id_external: z.string().optional().nullable(),
  lot_no: z.string().optional().nullable(),
  production_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  adjustment_piece_qty: z.number().int().refine(val => val !== 0, {
    message: 'จำนวนต้องไม่เป็น 0'
  }),
  remarks: z.string().optional().nullable(),
});

export const createAdjustmentSchema = z.object({
  adjustment_type: z.enum(['increase', 'decrease']),
  warehouse_id: z.string().min(1, 'Warehouse ID is required'),
  reason_id: z.number().int().refine(val => val > 0 || val === -1, {
    message: 'กรุณาเลือกเหตุผล'
  }),
  reference_no: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  created_by: z.number().int().positive().optional().nullable(),
  items: z.array(createAdjustmentItemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

export const updateAdjustmentSchema = z.object({
  reason_id: z.number().int().positive().optional(),
  reference_no: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  items: z.array(createAdjustmentItemSchema).optional(),
});

export const adjustmentFiltersSchema = z.object({
  adjustment_type: z.enum(['increase', 'decrease']).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled']).optional(),
  warehouse_id: z.string().optional(),
  reason_id: z.number().int().positive().optional(),
  created_by: z.number().int().positive().optional(),
  searchTerm: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

// ============================================================================
// INPUT TYPES
// ============================================================================

export type CreateAdjustmentItemInput = z.infer<typeof createAdjustmentItemSchema>;
export type CreateAdjustmentPayload = z.infer<typeof createAdjustmentSchema>;
export type UpdateAdjustmentPayload = z.infer<typeof updateAdjustmentSchema>;
export type AdjustmentFilters = z.infer<typeof adjustmentFiltersSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getStatusColor(status: AdjustmentStatus): string {
  switch (status) {
    case 'draft':
      return 'gray';
    case 'pending_approval':
      return 'yellow';
    case 'approved':
      return 'green';
    case 'rejected':
      return 'red';
    case 'completed':
      return 'blue';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

export function getStatusLabelTH(status: AdjustmentStatus): string {
  switch (status) {
    case 'draft':
      return 'แบบร่าง';
    case 'pending_approval':
      return 'รออนุมัติ';
    case 'approved':
      return 'อนุมัติแล้ว';
    case 'rejected':
      return 'ไม่อนุมัติ';
    case 'completed':
      return 'เสร็จสิ้น';
    case 'cancelled':
      return 'ยกเลิก';
    default:
      return status;
  }
}

export function getAdjustmentTypeLabelTH(type: AdjustmentType): string {
  switch (type) {
    case 'increase':
      return 'เพิ่มสต็อก';
    case 'decrease':
      return 'ลดสต็อก';
    default:
      return type;
  }
}

export function canEditAdjustment(status: AdjustmentStatus): boolean {
  return status === 'draft';
}

export function canSubmitAdjustment(status: AdjustmentStatus): boolean {
  return status === 'draft';
}

export function canApproveAdjustment(status: AdjustmentStatus): boolean {
  return status === 'pending_approval';
}

export function canRejectAdjustment(status: AdjustmentStatus): boolean {
  return status === 'pending_approval';
}

export function canCompleteAdjustment(status: AdjustmentStatus): boolean {
  return status === 'approved';
}

export function canCancelAdjustment(status: AdjustmentStatus): boolean {
  return status !== 'completed';
}

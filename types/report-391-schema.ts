/**
 * Stock Control Card 391 Report Types
 * BRCGS Compliant Stock Movement Report
 */

import { z } from 'zod'

// =====================================================
// Stock Control Card 391 Record Schema
// =====================================================

export const StockControlCard391RecordSchema = z.object({
  // Primary Key
  ledger_id: z.number(),
  
  // Transaction Info
  transaction_datetime: z.string(),
  transaction_type: z.string(),
  direction: z.enum(['in', 'out']),
  document_no: z.string().nullable(),
  document_type: z.string().nullable(),
  reference_doc_id: z.number().nullable(),
  
  // Product Info
  sku_id: z.string(),
  sku_name: z.string().nullable(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  unit: z.string().nullable(),
  qty_per_pack: z.number().nullable(),
  shelf_life_days: z.number().nullable(),
  rotation_method: z.string().nullable(),
  lot_tracking_required: z.boolean().nullable(),
  expiry_date_required: z.boolean().nullable(),
  
  // Pallet & Lot Info
  pallet_id: z.string().nullable(),
  pallet_id_external: z.string().nullable(),
  mfg_date: z.string().nullable(),
  exp_date: z.string().nullable(),
  remaining_shelf_life_days: z.number().nullable(),
  
  // Location Info
  warehouse_id: z.string(),
  warehouse_name: z.string().nullable(),
  location_id: z.string().nullable(),
  location_code: z.string().nullable(),
  zone: z.string().nullable(),
  aisle: z.string().nullable(),
  rack: z.string().nullable(),
  shelf: z.string().nullable(),
  location_type: z.string().nullable(),
  is_quarantine: z.boolean().nullable(),
  is_pick_face: z.boolean().nullable(),
  is_bulk_storage: z.boolean().nullable(),
  
  // Quantity (can be string from DB decimal type)
  qty_in_piece: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  qty_in_pack: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  qty_out_piece: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  qty_out_pack: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  balance_after_piece: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  balance_after_pack: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  
  // Adjustment Info
  adjustment_no: z.string().nullable(),
  adjustment_type: z.string().nullable(),
  adjustment_status: z.string().nullable(),
  adjustment_reason_code: z.string().nullable(),
  adjustment_reason: z.string().nullable(),
  adjustment_reason_type: z.string().nullable(),
  
  // Receive Info
  receive_no: z.string().nullable(),
  receive_type: z.string().nullable(),
  supplier_id: z.string().nullable(),
  supplier_name: z.string().nullable(),
  
  // Move Info
  move_no: z.string().nullable(),
  move_type: z.string().nullable(),
  
  // Audit Info
  performed_by_id: z.number().nullable(),
  performed_by: z.string().nullable(),
  performed_by_username: z.string().nullable(),
  remarks: z.string().nullable(),
  recorded_at: z.string().nullable(),
  
  // Additional References
  move_item_id: z.number().nullable(),
  receive_item_id: z.number().nullable(),
})

export type StockControlCard391Record = z.infer<typeof StockControlCard391RecordSchema>

// =====================================================
// Filter Schema
// =====================================================

export const Report391FilterSchema = z.object({
  warehouse_id: z.string().optional(),
  sku_id: z.string().optional(),
  sku_ids: z.array(z.string()).optional(),
  location_id: z.string().optional(),
  location_ids: z.array(z.string()).optional(),
  pallet_id: z.string().optional(),
  zone: z.string().optional(),
  transaction_type: z.string().optional(),
  transaction_types: z.array(z.string()).optional(),
  direction: z.enum(['in', 'out']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  is_quarantine: z.boolean().optional(),
  include_adjustments_only: z.boolean().optional(),
  search: z.string().optional(),
})

export type Report391Filter = z.infer<typeof Report391FilterSchema>

// =====================================================
// API Response Schema
// =====================================================

export const Report391ResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(StockControlCard391RecordSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
  }),
  summary: z.object({
    total_records: z.number(),
    total_qty_in: z.number(),
    total_qty_out: z.number(),
    unique_skus: z.number(),
    unique_locations: z.number(),
    date_range: z.object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    }),
  }).optional(),
  filters_applied: Report391FilterSchema.optional(),
})

export type Report391Response = z.infer<typeof Report391ResponseSchema>

// =====================================================
// Export Options Schema
// =====================================================

export const Report391ExportOptionsSchema = z.object({
  format: z.enum(['excel', 'pdf', 'csv']),
  include_summary: z.boolean().default(true),
  include_charts: z.boolean().default(false),
  columns: z.array(z.string()).optional(),
  filename: z.string().optional(),
})

export type Report391ExportOptions = z.infer<typeof Report391ExportOptionsSchema>

// =====================================================
// Column Definitions for UI
// =====================================================

export interface Report391Column {
  key: keyof StockControlCard391Record
  label: string
  labelTh: string
  width?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filterable?: boolean
  visible?: boolean
  format?: 'date' | 'datetime' | 'number' | 'currency' | 'boolean'
  brcRequired?: boolean // Required for BRCGS audit
}

export const REPORT_391_COLUMNS: Report391Column[] = [
  { key: 'transaction_datetime', label: 'Date/Time', labelTh: 'วันที่/เวลา', sortable: true, format: 'datetime', brcRequired: true },
  { key: 'transaction_type', label: 'Transaction Type', labelTh: 'ประเภท', sortable: true, filterable: true, brcRequired: true },
  { key: 'direction', label: 'Direction', labelTh: 'ทิศทาง', sortable: true, filterable: true, brcRequired: true },
  { key: 'document_no', label: 'Document No.', labelTh: 'เลขที่เอกสาร', sortable: true, brcRequired: true },
  { key: 'sku_id', label: 'SKU', labelTh: 'รหัสสินค้า', sortable: true, filterable: true, brcRequired: true },
  { key: 'sku_name', label: 'Product Name', labelTh: 'ชื่อสินค้า', sortable: true, brcRequired: true },
  { key: 'pallet_id', label: 'Pallet ID', labelTh: 'พาเลท', sortable: true, filterable: true, brcRequired: true },
  { key: 'mfg_date', label: 'MFG Date', labelTh: 'วันที่ผลิต', sortable: true, format: 'date', brcRequired: true },
  { key: 'exp_date', label: 'EXP Date', labelTh: 'วันหมดอายุ', sortable: true, format: 'date', brcRequired: true },
  { key: 'remaining_shelf_life_days', label: 'Remaining Days', labelTh: 'วันคงเหลือ', sortable: true, format: 'number' },
  { key: 'location_code', label: 'Location', labelTh: 'ตำแหน่ง', sortable: true, filterable: true, brcRequired: true },
  { key: 'zone', label: 'Zone', labelTh: 'โซน', sortable: true, filterable: true },
  { key: 'is_quarantine', label: 'Quarantine', labelTh: 'กักกัน', sortable: true, filterable: true, format: 'boolean', brcRequired: true },
  { key: 'qty_in_piece', label: 'Qty In', labelTh: 'จำนวนเข้า', align: 'right', format: 'number', brcRequired: true },
  { key: 'qty_out_piece', label: 'Qty Out', labelTh: 'จำนวนออก', align: 'right', format: 'number', brcRequired: true },
  { key: 'balance_after_piece', label: 'Balance', labelTh: 'ยอดคงเหลือ', align: 'right', format: 'number', brcRequired: true },
  { key: 'unit', label: 'Unit', labelTh: 'หน่วย', brcRequired: true },
  { key: 'adjustment_reason', label: 'Adj. Reason', labelTh: 'เหตุผลปรับปรุง', filterable: true },
  { key: 'performed_by', label: 'Performed By', labelTh: 'ผู้ปฏิบัติงาน', sortable: true, brcRequired: true },
  { key: 'remarks', label: 'Remarks', labelTh: 'หมายเหตุ' },
]

// Transaction type labels
export const TRANSACTION_TYPE_LABELS: Record<string, { en: string; th: string }> = {
  receive: { en: 'Receive', th: 'รับเข้า' },
  import: { en: 'Import', th: 'นำเข้าข้อมูล' },
  move: { en: 'Move/Transfer', th: 'ย้าย/โอน' },
  adjustment: { en: 'Adjustment', th: 'ปรับปรุง' },
  adjust: { en: 'Adjustment', th: 'ปรับปรุง' },
  pick: { en: 'Pick', th: 'หยิบ' },
  putaway: { en: 'Putaway', th: 'เก็บเข้าที่' },
  replenishment: { en: 'Replenishment', th: 'เติมสต็อก' },
  issue: { en: 'Issue', th: 'เบิกออก' },
  return: { en: 'Return', th: 'คืน' },
}

// Direction labels
export const DIRECTION_LABELS: Record<string, { en: string; th: string; color: string }> = {
  in: { en: 'IN', th: 'เข้า', color: 'green' },
  out: { en: 'OUT', th: 'ออก', color: 'red' },
}

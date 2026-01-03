/**
 * Production Report Types
 * รายงานการผลิต - แสดงข้อมูล traceability ของสินค้าสำเร็จรูป
 */

import { z } from 'zod'

// =====================================================
// Production Report Record Schema
// =====================================================

export const ProductionReportRecordSchema = z.object({
  // Primary Key
  receipt_id: z.string(),
  receipt_material_id: z.string().nullable(),
  
  // Production Order Info
  production_order_id: z.string(),
  production_no: z.string(),
  production_status: z.string().nullable(),
  
  // FG (Finished Goods) Info - สินค้าสำเร็จรูป
  fg_sku_id: z.string(),
  fg_sku_name: z.string().nullable(),
  fg_category: z.string().nullable(),
  fg_production_date: z.string().nullable(),
  fg_expiry_date: z.string().nullable(),
  fg_remarks: z.string().nullable(),
  fg_pallet_id: z.string().nullable(),
  fg_location_id: z.string().nullable(),
  fg_received_qty: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  fg_uom: z.string().nullable(),
  
  // Material Info - วัตถุดิบที่ใช้
  material_sku_id: z.string().nullable(),
  material_sku_name: z.string().nullable(),
  material_category: z.string().nullable(),
  material_pallet_id: z.string().nullable(),
  material_production_date: z.string().nullable(),
  material_expiry_date: z.string().nullable(),
  material_issued_qty: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  material_actual_qty: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  material_variance_qty: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
  material_variance_type: z.string().nullable(),
  material_variance_reason: z.string().nullable(),
  material_uom: z.string().nullable(),
  
  // Date Difference (FG - RM)
  production_date_diff_days: z.number().nullable(), // วันผลิต FG ต่อจาก RM มากี่วัน
  expiry_date_diff_days: z.number().nullable(), // วันหมดอายุ FG ต่อจาก RM มากี่วัน
  
  // Receipt Info
  received_at: z.string().nullable(),
  received_by_id: z.number().nullable(),
  received_by_name: z.string().nullable(),
  
  // Receive Info (from wms_receives)
  receive_id: z.string().nullable(),
  receive_no: z.string().nullable(),
  receive_status: z.string().nullable(),
  
  // Timestamps
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

export type ProductionReportRecord = z.infer<typeof ProductionReportRecordSchema>

// =====================================================
// Filter Schema
// =====================================================

export const ProductionReportFilterSchema = z.object({
  production_no: z.string().optional(),
  fg_sku_id: z.string().optional(),
  material_sku_id: z.string().optional(),
  fg_pallet_id: z.string().optional(),
  material_pallet_id: z.string().optional(),
  production_status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
})

export type ProductionReportFilter = z.infer<typeof ProductionReportFilterSchema>

// =====================================================
// API Response Schema
// =====================================================

export const ProductionReportResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ProductionReportRecordSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
  }),
  summary: z.object({
    total_records: z.number(),
    total_production_orders: z.number(),
    total_fg_qty: z.number(),
    total_material_issued: z.number(),
    total_material_actual: z.number(),
    total_variance: z.number(),
    date_range: z.object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    }),
  }).optional(),
  filters_applied: ProductionReportFilterSchema.optional(),
})

export type ProductionReportResponse = z.infer<typeof ProductionReportResponseSchema>

// =====================================================
// Column Definitions for UI
// =====================================================

export interface ProductionReportColumn {
  key: keyof ProductionReportRecord
  label: string
  labelTh: string
  width?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filterable?: boolean
  visible?: boolean
  format?: 'date' | 'datetime' | 'number' | 'currency' | 'boolean'
}

export const PRODUCTION_REPORT_COLUMNS: ProductionReportColumn[] = [
  { key: 'received_at', label: 'Date/Time', labelTh: 'วันที่/เวลารับ', sortable: true, format: 'datetime' },
  { key: 'production_no', label: 'Production No.', labelTh: 'เลขที่ใบสั่งผลิต', sortable: true, filterable: true },
  { key: 'production_status', label: 'Status', labelTh: 'สถานะ', sortable: true, filterable: true },
  { key: 'fg_sku_id', label: 'FG SKU', labelTh: 'รหัส FG', sortable: true, filterable: true },
  { key: 'fg_sku_name', label: 'FG Name', labelTh: 'ชื่อ FG', sortable: true },
  { key: 'fg_pallet_id', label: 'FG Pallet', labelTh: 'พาเลท FG', sortable: true },
  { key: 'fg_production_date', label: 'FG MFG Date', labelTh: 'วันผลิต FG', sortable: true, format: 'date' },
  { key: 'fg_expiry_date', label: 'FG EXP Date', labelTh: 'วันหมดอายุ FG', sortable: true, format: 'date' },
  { key: 'fg_received_qty', label: 'FG Qty', labelTh: 'จำนวน FG', align: 'right', format: 'number' },
  { key: 'material_sku_id', label: 'Material SKU', labelTh: 'รหัสวัตถุดิบ', sortable: true, filterable: true },
  { key: 'material_sku_name', label: 'Material Name', labelTh: 'ชื่อวัตถุดิบ', sortable: true },
  { key: 'material_pallet_id', label: 'Material Pallet', labelTh: 'พาเลทวัตถุดิบ', sortable: true },
  { key: 'material_production_date', label: 'Material MFG', labelTh: 'วันผลิตวัตถุดิบ', sortable: true, format: 'date' },
  { key: 'material_expiry_date', label: 'Material EXP', labelTh: 'วันหมดอายุวัตถุดิบ', sortable: true, format: 'date' },
  { key: 'material_issued_qty', label: 'Issued Qty', labelTh: 'จำนวนเบิก', align: 'right', format: 'number' },
  { key: 'material_actual_qty', label: 'Actual Qty', labelTh: 'จำนวนใช้จริง', align: 'right', format: 'number' },
  { key: 'material_variance_qty', label: 'Variance', labelTh: 'ส่วนต่าง', align: 'right', format: 'number' },
  { key: 'material_variance_type', label: 'Variance Type', labelTh: 'ประเภทส่วนต่าง', sortable: true },
  { key: 'received_by_name', label: 'Received By', labelTh: 'ผู้รับ', sortable: true },
]

// Production status labels
export const PRODUCTION_STATUS_LABELS: Record<string, { en: string; th: string; color: string }> = {
  planned: { en: 'Planned', th: 'วางแผน', color: 'gray' },
  released: { en: 'Released', th: 'ปล่อยงาน', color: 'blue' },
  in_progress: { en: 'In Progress', th: 'กำลังผลิต', color: 'yellow' },
  completed: { en: 'Completed', th: 'เสร็จสิ้น', color: 'green' },
  on_hold: { en: 'On Hold', th: 'พักงาน', color: 'orange' },
  cancelled: { en: 'Cancelled', th: 'ยกเลิก', color: 'red' },
}

// Variance type labels
export const VARIANCE_TYPE_LABELS: Record<string, { en: string; th: string; color: string }> = {
  exact: { en: 'Exact', th: 'ตรงกัน', color: 'green' },
  shortage: { en: 'Shortage', th: 'ใช้น้อยกว่า', color: 'blue' },
  excess: { en: 'Excess', th: 'ใช้มากกว่า', color: 'red' },
}

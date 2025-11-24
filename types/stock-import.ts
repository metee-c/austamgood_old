// ============================================================================
// Stock Import Types
// ============================================================================

/**
 * สถานะของ Import Batch
 */
export type StockImportBatchStatus =
  | 'uploading'     // กำลังอัพโหลดไฟล์
  | 'validating'    // กำลังตรวจสอบข้อมูล
  | 'validated'     // ตรวจสอบเสร็จแล้ว
  | 'processing'    // กำลังประมวลผล/นำเข้า
  | 'completed'     // นำเข้าเสร็จสมบูรณ์
  | 'failed'        // เกิดข้อผิดพลาด
  | 'cancelled';    // ยกเลิก

/**
 * สถานะของ Staging Record
 */
export type StockImportStagingStatus =
  | 'pending'       // รอการตรวจสอบ
  | 'validated'     // ตรวจสอบผ่านแล้ว
  | 'processed'     // ประมวลผลเสร็จแล้ว
  | 'error'         // มีข้อผิดพลาด
  | 'skipped';      // ข้ามไป (เช่น SKU ไม่มี)

/**
 * ประเภทไฟล์ที่รองรับ
 */
export type ImportFileType = 'csv' | 'excel';

// ============================================================================
// Import Batch
// ============================================================================

/**
 * ข้อมูล Import Batch
 */
export interface StockImportBatch {
  batch_id: string;
  batch_name: string | null;
  warehouse_id: string;

  // ข้อมูลไฟล์
  file_name: string | null;
  file_size: number | null;
  file_type: ImportFileType | null;
  total_rows: number;

  // สถิติการประมวลผล
  validated_rows: number;
  error_rows: number;
  processed_rows: number;
  skipped_rows: number;

  // สถานะ
  status: StockImportBatchStatus;

  // เวลา
  started_at: string | null;
  completed_at: string | null;

  // ผู้ใช้
  created_by: number;
  created_at: string;

  // สรุปผลลัพธ์ (JSON)
  validation_summary: ValidationSummary | null;
  processing_summary: ProcessingSummary | null;
  error_summary: ErrorSummary | null;
}

/**
 * สรุปผลการตรวจสอบ
 */
export interface ValidationSummary {
  total_checked: number;
  valid_count: number;
  error_count: number;
  warning_count: number;

  // รายละเอียด error ตามประเภท
  errors_by_type: {
    [errorType: string]: number;
  };

  // รายการ SKU ที่ไม่พบ
  missing_skus: string[];

  // รายการ Location ที่จะสร้างใหม่
  new_locations: string[];

  validation_time_seconds: number;
}

/**
 * สรุปผลการประมวลผล
 */
export interface ProcessingSummary {
  total_processed: number;
  success_count: number;
  error_count: number;

  // จำนวน records ที่สร้าง/อัพเดท
  locations_created: number;
  locations_updated: number;
  balances_created: number;
  balances_updated: number;
  ledger_entries_created: number;

  // ปริมาณสินค้าทั้งหมด
  total_piece_qty_imported: number;
  total_pack_qty_imported: number;
  total_weight_kg_imported: number;

  processing_time_seconds: number;
}

/**
 * สรุป Error
 */
export interface ErrorSummary {
  critical_errors: ErrorDetail[];
  warnings: ErrorDetail[];

  // จำนวน error แบ่งตาม severity
  by_severity: {
    critical: number;
    error: number;
    warning: number;
  };
}

export interface ErrorDetail {
  row_number: number;
  field: string;
  error_type: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  suggested_fix?: string;
}

// ============================================================================
// Staging Data
// ============================================================================

/**
 * ข้อมูล Staging Record (ก่อนนำเข้าจริง)
 */
export interface StockImportStaging {
  staging_id: number;
  import_batch_id: string;
  row_number: number | null;

  // ข้อมูลจากไฟล์ระบบเก่า
  location_id: string | null;
  zone: string | null;
  row_code: string | null;
  level_code: string | null;
  loc_code: string | null;
  sku_pick_face: string | null;
  max_weight: number | null;
  max_pallet: number | null;
  max_high: string | null;
  location_status: string | null;

  pallet_id_check: string | null;
  pallet_id_external: string | null;
  last_updated_check: string | null;
  last_updated_check_2: string | null;
  last_updated: string | null;

  sku_id: string | null;
  product_name: string | null;
  pack_qty: number | null;
  piece_qty: number | null;
  weight_kg: number | null;
  lot_no: string | null;
  received_date: string | null;
  expiration_date: string | null;
  barcode: string | null;
  name_edit: string | null;
  stock_status: string | null;
  pallet_color: string | null;
  remarks: string | null;

  // ข้อมูลเพิ่มเติม
  warehouse_id: string | null;

  // วันที่ที่แปลงแล้ว
  parsed_received_date: string | null;
  parsed_expiration_date: string | null;
  parsed_last_updated: string | null;

  // สถานะการประมวลผล
  processing_status: StockImportStagingStatus;
  validation_errors: string[] | null;
  validation_warnings: string[] | null;

  processed_at: string | null;
  processed_balance_id: number | null;
  processed_ledger_id: number | null;

  created_at: string;
  created_by: number | null;
}

// ============================================================================
// Import Request/Response Types
// ============================================================================

/**
 * Request สำหรับสร้าง Import Batch ใหม่
 */
export interface CreateImportBatchRequest {
  warehouse_id: string;
  batch_name?: string;
  file: File;
}

/**
 * Response หลังสร้าง Import Batch
 */
export interface CreateImportBatchResponse {
  batch_id: string;
  total_rows: number;
  status: StockImportBatchStatus;
  message: string;
}

/**
 * Request สำหรับ Validate Batch
 */
export interface ValidateImportBatchRequest {
  batch_id: string;
}

/**
 * Response หลัง Validate
 */
export interface ValidateImportBatchResponse {
  batch_id: string;
  status: StockImportBatchStatus;
  validation_summary: ValidationSummary;
  errors: ErrorDetail[];
  warnings: ErrorDetail[];
}

/**
 * Request สำหรับ Process Batch (นำเข้าจริง)
 */
export interface ProcessImportBatchRequest {
  batch_id: string;
  skip_errors?: boolean; // ข้าม records ที่มี error หรือไม่
}

/**
 * Response หลัง Process
 */
export interface ProcessImportBatchResponse {
  batch_id: string;
  status: StockImportBatchStatus;
  processing_summary: ProcessingSummary;
  errors: ErrorDetail[];
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * ข้อมูลแถวจาก CSV (Raw Data)
 */
export interface ImportRowData {
  'Location_ID'?: string;
  'Zone'?: string;
  'Row'?: string;
  'Level'?: string;
  'Loc'?: string;
  'SKU Pick Face'?: string;
  'Max_Weight'?: string;
  'Max_Pallet'?: string;
  'Max_High'?: string;
  'Status'?: string;
  'Pallet_ID_Check'?: string;
  'Pallet_ID'?: string;
  'Last_Updated_Check'?: string;
  'Last_Updated_Check_2'?: string;
  'Last_Updated'?: string;
  'SKU'?: string;
  'Product_Name'?: string;
  'แพ็ค'?: string;
  'ชิ้น'?: string;
  'น้ำหนัก'?: string;
  'Lot'?: string;
  'Received_Date'?: string;
  'Expiration_Date'?: string;
  'Barcode'?: string;
  'Name_edit'?: string;
  // 'Status'?: string;  // ซ้ำกับ Location Status
  'สีพาเลท'?: string;
  'หมายเหตุ'?: string;
}

/**
 * Parsed Data (หลังแปลงและ validate)
 */
export interface ParsedImportRow {
  // Location Data
  location_id: string;
  zone: string | null;
  row_code: string | null;
  level_code: string | null;
  loc_code: string | null;
  max_weight: number | null;
  max_pallet: number | null;
  max_high: string | null;
  location_status: string | null;

  // Stock Data
  sku_id: string | null;
  pallet_id_external: string | null;
  pack_qty: number | null;
  piece_qty: number | null;
  weight_kg: number | null;
  lot_no: string | null;

  // Dates
  received_date: Date | null;
  expiration_date: Date | null;
  last_updated: Date | null;

  // Additional Info
  product_name: string | null;
  barcode: string | null;
  name_edit: string | null;
  stock_status: string | null;
  pallet_color: string | null;
  remarks: string | null;

  // Validation
  is_valid: boolean;
  has_stock: boolean;  // มีสินค้าหรือไม่ (piece_qty > 0)
  errors: string[];
  warnings: string[];
}

/**
 * Import Progress (สำหรับแสดง progress bar)
 */
export interface ImportProgress {
  batch_id: string;
  current_step: 'upload' | 'validate' | 'process';
  current_row: number;
  total_rows: number;
  percentage: number;
  message: string;
  errors_count: number;
  warnings_count: number;
}

/**
 * Import Statistics (สำหรับ Dashboard)
 */
export interface ImportStatistics {
  total_batches: number;
  completed_batches: number;
  failed_batches: number;
  total_rows_imported: number;
  total_items_imported: number;
  total_weight_imported: number;
  avg_processing_time_seconds: number;
  last_import_date: string | null;
}

// ============================================================================
// View Types
// ============================================================================

/**
 * View สำหรับแสดงสรุป Import Batches (จาก vw_stock_import_batches_summary)
 */
export interface StockImportBatchSummary {
  batch_id: string;
  batch_name: string | null;
  warehouse_id: string;
  warehouse_name: string | null;
  file_name: string | null;
  file_type: ImportFileType | null;
  total_rows: number;
  validated_rows: number;
  error_rows: number;
  processed_rows: number;
  skipped_rows: number;
  status: StockImportBatchStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  processing_duration_seconds: number | null;
  success_percentage: number | null;
  created_by_name: string | null;
  validation_summary: ValidationSummary | null;
  processing_summary: ProcessingSummary | null;
  error_summary: ErrorSummary | null;
}

// ============================================================================
// Validation Error Types
// ============================================================================

export enum ValidationErrorType {
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_DATE_FORMAT = 'invalid_date_format',
  INVALID_NUMBER_FORMAT = 'invalid_number_format',
  SKU_NOT_FOUND = 'sku_not_found',
  WAREHOUSE_NOT_FOUND = 'warehouse_not_found',
  LOCATION_INVALID = 'location_invalid',
  NEGATIVE_QUANTITY = 'negative_quantity',
  DUPLICATE_RECORD = 'duplicate_record',
  EXPIRY_DATE_BEFORE_PRODUCTION = 'expiry_date_before_production',
  DATA_TOO_LONG = 'data_too_long',
}

export const ValidationErrorMessages: Record<ValidationErrorType, string> = {
  [ValidationErrorType.MISSING_REQUIRED_FIELD]: 'ข้อมูลที่จำเป็นหายไป',
  [ValidationErrorType.INVALID_DATE_FORMAT]: 'รูปแบบวันที่ไม่ถูกต้อง',
  [ValidationErrorType.INVALID_NUMBER_FORMAT]: 'รูปแบบตัวเลขไม่ถูกต้อง',
  [ValidationErrorType.SKU_NOT_FOUND]: 'ไม่พบ SKU ในระบบ',
  [ValidationErrorType.WAREHOUSE_NOT_FOUND]: 'ไม่พบคลังสินค้า',
  [ValidationErrorType.LOCATION_INVALID]: 'รหัสตำแหน่งไม่ถูกต้อง',
  [ValidationErrorType.NEGATIVE_QUANTITY]: 'จำนวนต้องไม่เป็นลบ',
  [ValidationErrorType.DUPLICATE_RECORD]: 'ข้อมูลซ้ำ',
  [ValidationErrorType.EXPIRY_DATE_BEFORE_PRODUCTION]: 'วันหมดอายุก่อนวันผลิต',
  [ValidationErrorType.DATA_TOO_LONG]: 'ข้อมูลยาวเกินไป',
};

// ============================================================================
// Picking Area Import Types
// ============================================================================

/**
 * ข้อมูลแถวจาก CSV สำหรับ Picking Area (พื้นที่หยิบ)
 */
export interface PickingAreaImportRowData {
  'SKU'?: string;
  'Product_Name'?: string;
  'Type'?: string;
  'Barcode'?: string;
  'Unit'?: string;
  'จำนวนน้ำหนัก (ปกติ)'?: string;  // Weight
  'จำนวนถุง (ปกติ)'?: string;        // Quantity (Bags/Units)
  'Remark'?: string;
}

/**
 * Parsed Data สำหรับ Picking Area Import
 */
export interface ParsedPickingAreaRow {
  sku_id: string;
  product_name: string | null;
  product_type: string | null;
  barcode: string | null;
  unit: string | null;
  weight_kg: number | null;
  quantity: number | null;
  remarks: string | null;

  // Validation
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Request สำหรับนำเข้า Picking Area
 */
export interface PickingAreaImportRequest {
  warehouse_id: string;
  location_id: string;  // PK001 หรือ location อื่นๆ ที่เป็น picking area
  file: File;
  batch_name?: string;
}

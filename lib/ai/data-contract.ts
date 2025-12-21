/**
 * AI Data Contract
 * Defines EXACTLY what data is available for AI to answer questions
 * 
 * PRINCIPLE: AI can ONLY answer questions where data exists
 * NO GUESSING, NO ESTIMATION, NO HALLUCINATION
 */

// ============================================
// Data Availability Matrix
// ============================================

export interface DataField {
  field: string;
  table: string;
  type: 'direct' | 'derived' | 'not_available';
  description: string;
  calculation?: string;
  dependencies?: string[];
}

export interface QuestionCategory {
  category: string;
  categoryThai: string;
  questions: AnswerableQuestion[];
}

export interface AnswerableQuestion {
  question: string;
  questionThai: string;
  canAnswer: boolean;
  requiredData: DataField[];
  missingData?: DataField[];
  alternativeQuestion?: string;
  alternativeQuestionThai?: string;
  apiEndpoint?: string;
}

// ============================================
// Available Data Fields (from actual tables)
// ============================================

export const AVAILABLE_DATA: Record<string, DataField[]> = {
  // === INVENTORY BALANCES ===
  inventory_balance: [
    { field: 'total_piece_qty', table: 'wms_inventory_balances', type: 'direct', description: 'จำนวนสต็อกทั้งหมด (ชิ้น)' },
    { field: 'reserved_piece_qty', table: 'wms_inventory_balances', type: 'direct', description: 'จำนวนที่สำรองแล้ว (ชิ้น)' },
    { field: 'available_qty', table: 'wms_inventory_balances', type: 'derived', description: 'จำนวนพร้อมใช้งาน', calculation: 'total_piece_qty - reserved_piece_qty' },
    { field: 'sku_id', table: 'wms_inventory_balances', type: 'direct', description: 'รหัสสินค้า' },
    { field: 'location_id', table: 'wms_inventory_balances', type: 'direct', description: 'รหัสโลเคชั่น' },
    { field: 'warehouse_id', table: 'wms_inventory_balances', type: 'direct', description: 'รหัสคลัง' },
    { field: 'lot_no', table: 'wms_inventory_balances', type: 'direct', description: 'เลข Lot' },
    { field: 'expiry_date', table: 'wms_inventory_balances', type: 'direct', description: 'วันหมดอายุ' },
    { field: 'pallet_id', table: 'wms_inventory_balances', type: 'direct', description: 'รหัสพาเลท' },
  ],

  // === INVENTORY LEDGER (Movements) ===
  inventory_ledger: [
    { field: 'movement_at', table: 'wms_inventory_ledger', type: 'direct', description: 'วันเวลาที่เคลื่อนไหว' },
    { field: 'transaction_type', table: 'wms_inventory_ledger', type: 'direct', description: 'ประเภทธุรกรรม (receive/ship/transfer/adjustment)' },
    { field: 'direction', table: 'wms_inventory_ledger', type: 'direct', description: 'ทิศทาง (in/out)' },
    { field: 'pack_qty', table: 'wms_inventory_ledger', type: 'direct', description: 'จำนวนแพ็ค' },
    { field: 'piece_qty', table: 'wms_inventory_ledger', type: 'direct', description: 'จำนวนชิ้น' },
    { field: 'sku_id', table: 'wms_inventory_ledger', type: 'direct', description: 'รหัสสินค้า' },
    { field: 'location_id', table: 'wms_inventory_ledger', type: 'direct', description: 'รหัสโลเคชั่น' },
    { field: 'reference_no', table: 'wms_inventory_ledger', type: 'direct', description: 'เลขอ้างอิง' },
    { field: 'order_id', table: 'wms_inventory_ledger', type: 'direct', description: 'รหัสออเดอร์' },
  ],

  // === ORDERS ===
  orders: [
    { field: 'order_id', table: 'wms_orders', type: 'direct', description: 'รหัสออเดอร์' },
    { field: 'order_no', table: 'wms_orders', type: 'direct', description: 'เลขที่ออเดอร์' },
    { field: 'order_type', table: 'wms_orders', type: 'direct', description: 'ประเภทออเดอร์' },
    { field: 'order_date', table: 'wms_orders', type: 'direct', description: 'วันที่ออเดอร์' },
    { field: 'delivery_date', table: 'wms_orders', type: 'direct', description: 'วันที่ส่ง' },
    { field: 'status', table: 'wms_orders', type: 'direct', description: 'สถานะ (draft/confirmed/in_picking/picked/loaded/in_transit/delivered)' },
    { field: 'customer_id', table: 'wms_orders', type: 'direct', description: 'รหัสลูกค้า' },
    { field: 'total_qty', table: 'wms_orders', type: 'direct', description: 'จำนวนรวม' },
    { field: 'total_items', table: 'wms_orders', type: 'direct', description: 'จำนวนรายการ' },
  ],

  // === ORDER ITEMS ===
  order_items: [
    { field: 'order_item_id', table: 'wms_order_items', type: 'direct', description: 'รหัสรายการ' },
    { field: 'order_id', table: 'wms_order_items', type: 'direct', description: 'รหัสออเดอร์' },
    { field: 'sku_id', table: 'wms_order_items', type: 'direct', description: 'รหัสสินค้า' },
    { field: 'order_qty', table: 'wms_order_items', type: 'direct', description: 'จำนวนสั่ง' },
    { field: 'picked_qty', table: 'wms_order_items', type: 'direct', description: 'จำนวนที่จัดแล้ว' },
  ],

  // === LOCATIONS ===
  locations: [
    { field: 'location_id', table: 'master_location', type: 'direct', description: 'รหัสโลเคชั่น' },
    { field: 'location_code', table: 'master_location', type: 'direct', description: 'รหัสโลเคชั่น' },
    { field: 'location_name', table: 'master_location', type: 'direct', description: 'ชื่อโลเคชั่น' },
    { field: 'location_type', table: 'master_location', type: 'direct', description: 'ประเภท (rack/floor/staging)' },
    { field: 'zone', table: 'master_location', type: 'direct', description: 'โซน' },
    { field: 'max_capacity_qty', table: 'master_location', type: 'direct', description: 'ความจุสูงสุด' },
    { field: 'current_qty', table: 'master_location', type: 'direct', description: 'จำนวนปัจจุบัน' },
    { field: 'is_pick_face', table: 'master_location', type: 'direct', description: 'เป็น Pick Face หรือไม่' },
    { field: 'is_bulk_storage', table: 'master_location', type: 'direct', description: 'เป็น Bulk Storage หรือไม่' },
  ],

  // === SKU MASTER ===
  sku: [
    { field: 'sku_id', table: 'master_sku', type: 'direct', description: 'รหัสสินค้า' },
    { field: 'sku_name', table: 'master_sku', type: 'direct', description: 'ชื่อสินค้า' },
    { field: 'category', table: 'master_sku', type: 'direct', description: 'หมวดหมู่' },
    { field: 'qty_per_pack', table: 'master_sku', type: 'direct', description: 'จำนวนต่อแพ็ค' },
    { field: 'shelf_life_days', table: 'master_sku', type: 'direct', description: 'อายุการเก็บรักษา (วัน)' },
    { field: 'reorder_point', table: 'master_sku', type: 'direct', description: 'จุดสั่งซื้อใหม่' },
    { field: 'safety_stock', table: 'master_sku', type: 'direct', description: 'สต็อกปลอดภัย' },
  ],

  // === PRODUCTION ORDERS ===
  production: [
    { field: 'id', table: 'production_orders', type: 'direct', description: 'รหัสใบสั่งผลิต' },
    { field: 'production_no', table: 'production_orders', type: 'direct', description: 'เลขที่ใบสั่งผลิต' },
    { field: 'sku_id', table: 'production_orders', type: 'direct', description: 'รหัสสินค้าที่ผลิต' },
    { field: 'quantity', table: 'production_orders', type: 'direct', description: 'จำนวนที่สั่งผลิต' },
    { field: 'produced_qty', table: 'production_orders', type: 'direct', description: 'จำนวนที่ผลิตแล้ว' },
    { field: 'status', table: 'production_orders', type: 'direct', description: 'สถานะ (planned/released/in_progress/completed)' },
    { field: 'start_date', table: 'production_orders', type: 'direct', description: 'วันเริ่มผลิต' },
    { field: 'due_date', table: 'production_orders', type: 'direct', description: 'วันกำหนดเสร็จ' },
  ],

  // === WAREHOUSE ===
  warehouse: [
    { field: 'warehouse_id', table: 'master_warehouse', type: 'direct', description: 'รหัสคลัง' },
    { field: 'warehouse_name', table: 'master_warehouse', type: 'direct', description: 'ชื่อคลัง' },
    { field: 'capacity_qty', table: 'master_warehouse', type: 'direct', description: 'ความจุ' },
  ],

  // === TRANSFERS (Phase B Enhancement) ===
  transfers: [
    { field: 'move_id', table: 'wms_moves', type: 'direct', description: 'รหัสใบโอนย้าย' },
    { field: 'move_no', table: 'wms_moves', type: 'direct', description: 'เลขที่ใบโอนย้าย' },
    { field: 'status', table: 'wms_moves', type: 'direct', description: 'สถานะ (draft/in_progress/completed/cancelled)' },
    { field: 'from_location_id', table: 'wms_move_items', type: 'direct', description: 'โลเคชั่นต้นทาง' },
    { field: 'to_location_id', table: 'wms_move_items', type: 'direct', description: 'โลเคชั่นปลายทาง' },
    { field: 'quantity', table: 'wms_move_items', type: 'direct', description: 'จำนวนที่โอน' },
  ],

  // === STOCK ADJUSTMENTS (Phase B Enhancement) ===
  stock_adjustments: [
    { field: 'adjustment_id', table: 'wms_stock_adjustments', type: 'direct', description: 'รหัสใบปรับสต็อก' },
    { field: 'adjustment_no', table: 'wms_stock_adjustments', type: 'direct', description: 'เลขที่ใบปรับสต็อก' },
    { field: 'status', table: 'wms_stock_adjustments', type: 'direct', description: 'สถานะ (draft/pending_approval/approved/rejected/completed)' },
    { field: 'adjustment_type', table: 'wms_stock_adjustments', type: 'direct', description: 'ประเภท (increase/decrease/damage/expired/count)' },
    { field: 'quantity', table: 'wms_stock_adjustment_items', type: 'direct', description: 'จำนวนที่ปรับ' },
    { field: 'reason', table: 'wms_stock_adjustments', type: 'direct', description: 'เหตุผล' },
  ],

  // === FACE SHEETS (Phase B Enhancement) ===
  face_sheets: [
    { field: 'face_sheet_id', table: 'face_sheets', type: 'direct', description: 'รหัสใบปะหน้า' },
    { field: 'face_sheet_no', table: 'face_sheets', type: 'direct', description: 'เลขที่ใบปะหน้า' },
    { field: 'status', table: 'face_sheets', type: 'direct', description: 'สถานะ (pending/in_progress/completed/cancelled)' },
    { field: 'picklist_id', table: 'face_sheets', type: 'direct', description: 'รหัสใบหยิบ' },
    { field: 'order_id', table: 'face_sheets', type: 'direct', description: 'รหัสออเดอร์' },
    { field: 'total_packages', table: 'face_sheets', type: 'derived', description: 'จำนวนแพ็คเกจ' },
  ],

  // === BONUS FACE SHEETS (Phase B Enhancement) ===
  bonus_face_sheets: [
    { field: 'bonus_face_sheet_id', table: 'bonus_face_sheets', type: 'direct', description: 'รหัสใบปะหน้าของแถม' },
    { field: 'status', table: 'bonus_face_sheets', type: 'direct', description: 'สถานะ' },
    { field: 'order_id', table: 'bonus_face_sheets', type: 'direct', description: 'รหัสออเดอร์' },
    { field: 'total_qty', table: 'bonus_face_sheets', type: 'direct', description: 'จำนวนรวม' },
  ],

  // === LOADLISTS (Phase B Enhancement) ===
  loadlists: [
    { field: 'loadlist_id', table: 'loadlists', type: 'direct', description: 'รหัสใบโหลด' },
    { field: 'loadlist_no', table: 'loadlists', type: 'direct', description: 'เลขที่ใบโหลด' },
    { field: 'status', table: 'loadlists', type: 'direct', description: 'สถานะ (draft/ready/loading/loaded/departed)' },
    { field: 'vehicle_id', table: 'loadlists', type: 'direct', description: 'รหัสรถ' },
    { field: 'route_plan_id', table: 'loadlists', type: 'direct', description: 'รหัสแผนเส้นทาง' },
    { field: 'loading_door', table: 'loadlists', type: 'direct', description: 'ประตูโหลด' },
  ],

  // === REPLENISHMENT (Phase B Enhancement) ===
  replenishment: [
    { field: 'queue_id', table: 'replenishment_queue', type: 'direct', description: 'รหัสคิว' },
    { field: 'status', table: 'replenishment_queue', type: 'direct', description: 'สถานะ (pending/in_progress/completed/cancelled)' },
    { field: 'priority', table: 'replenishment_queue', type: 'direct', description: 'ความสำคัญ (low/medium/high/urgent)' },
    { field: 'from_location_id', table: 'replenishment_queue', type: 'direct', description: 'โลเคชั่นต้นทาง' },
    { field: 'to_location_id', table: 'replenishment_queue', type: 'direct', description: 'โลเคชั่นปลายทาง' },
    { field: 'requested_qty', table: 'replenishment_queue', type: 'direct', description: 'จำนวนที่ขอ' },
    { field: 'completed_qty', table: 'replenishment_queue', type: 'direct', description: 'จำนวนที่เสร็จ' },
  ],

  // === PRODUCTION PLAN (Phase B Enhancement) ===
  production_plan: [
    { field: 'plan_id', table: 'production_plan', type: 'direct', description: 'รหัสแผนผลิต' },
    { field: 'plan_no', table: 'production_plan', type: 'direct', description: 'เลขที่แผนผลิต' },
    { field: 'status', table: 'production_plan', type: 'direct', description: 'สถานะ (draft/approved/in_progress/completed)' },
    { field: 'planned_qty', table: 'production_plan', type: 'direct', description: 'จำนวนที่วางแผน' },
    { field: 'actual_qty', table: 'production_plan', type: 'direct', description: 'จำนวนจริง' },
    { field: 'plan_date', table: 'production_plan', type: 'direct', description: 'วันที่วางแผน' },
  ],

  // === MATERIAL ISSUES (Phase B Enhancement) ===
  material_issues: [
    { field: 'issue_id', table: 'material_issues', type: 'direct', description: 'รหัสใบเบิก' },
    { field: 'issue_no', table: 'material_issues', type: 'direct', description: 'เลขที่ใบเบิก' },
    { field: 'status', table: 'material_issues', type: 'direct', description: 'สถานะ (draft/pending/issued/cancelled)' },
    { field: 'production_order_id', table: 'material_issues', type: 'direct', description: 'รหัสใบสั่งผลิต' },
    { field: 'requested_qty', table: 'material_issues', type: 'direct', description: 'จำนวนที่ขอ' },
    { field: 'issued_qty', table: 'material_issues', type: 'direct', description: 'จำนวนที่เบิก' },
  ],

  // === SUPPLIERS (Phase B Enhancement) ===
  suppliers: [
    { field: 'supplier_id', table: 'master_supplier', type: 'direct', description: 'รหัสซัพพลายเออร์' },
    { field: 'supplier_name', table: 'master_supplier', type: 'direct', description: 'ชื่อซัพพลายเออร์' },
    { field: 'contact_name', table: 'master_supplier', type: 'direct', description: 'ชื่อผู้ติดต่อ' },
    { field: 'phone', table: 'master_supplier', type: 'direct', description: 'เบอร์โทร' },
    { field: 'is_active', table: 'master_supplier', type: 'direct', description: 'สถานะใช้งาน' },
  ],

  // === VEHICLES (Phase B Enhancement) ===
  vehicles: [
    { field: 'vehicle_id', table: 'master_vehicle', type: 'direct', description: 'รหัสรถ' },
    { field: 'plate_number', table: 'master_vehicle', type: 'direct', description: 'ทะเบียนรถ' },
    { field: 'vehicle_type', table: 'master_vehicle', type: 'direct', description: 'ประเภทรถ' },
    { field: 'status', table: 'master_vehicle', type: 'direct', description: 'สถานะ (available/in_use/maintenance)' },
    { field: 'capacity_kg', table: 'master_vehicle', type: 'direct', description: 'ความจุ (กก.)' },
    { field: 'driver_name', table: 'master_vehicle', type: 'direct', description: 'ชื่อคนขับ' },
  ],

  // === PREPARATION AREAS (Phase B Enhancement) ===
  preparation_areas: [
    { field: 'area_id', table: 'preparation_areas', type: 'direct', description: 'รหัสพื้นที่' },
    { field: 'area_code', table: 'preparation_areas', type: 'direct', description: 'รหัสพื้นที่' },
    { field: 'area_name', table: 'preparation_areas', type: 'direct', description: 'ชื่อพื้นที่' },
    { field: 'is_active', table: 'preparation_areas', type: 'direct', description: 'สถานะใช้งาน' },
  ],
};

// ============================================
// NOT Available Data (Critical for AI to know)
// ============================================

export const NOT_AVAILABLE_DATA: DataField[] = [
  // === CONSUMPTION / DEMAND ===
  { 
    field: 'daily_consumption_rate', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'อัตราการใช้ต่อวัน - ไม่มีตารางเก็บข้อมูลนี้โดยตรง',
    calculation: 'ต้องคำนวณจาก wms_inventory_ledger (direction=out) แต่ไม่มี API'
  },
  { 
    field: 'weekly_consumption_rate', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'อัตราการใช้ต่อสัปดาห์'
  },
  { 
    field: 'monthly_consumption_rate', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'อัตราการใช้ต่อเดือน'
  },

  // === DAYS OF COVER ===
  { 
    field: 'days_of_cover', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'จำนวนวันที่สต็อกจะหมด',
    calculation: 'ต้องการ: current_stock / daily_consumption_rate',
    dependencies: ['daily_consumption_rate']
  },

  // === FORECAST ===
  { 
    field: 'demand_forecast', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'พยากรณ์ความต้องการ - ไม่มีตาราง forecast'
  },
  { 
    field: 'sales_forecast', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'พยากรณ์ยอดขาย'
  },

  // === LEAD TIME ===
  { 
    field: 'supplier_lead_time', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'Lead time จาก Supplier - ไม่มีในตาราง master_supplier'
  },
  { 
    field: 'production_lead_time', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'Lead time การผลิต'
  },

  // === COST ===
  { 
    field: 'unit_cost', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'ต้นทุนต่อหน่วย - ไม่มีในตาราง master_sku'
  },
  { 
    field: 'inventory_value', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'มูลค่าสต็อก',
    dependencies: ['unit_cost']
  },

  // === PRODUCTIVITY ===
  { 
    field: 'picks_per_hour', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'จำนวน Pick ต่อชั่วโมง - ไม่มีการเก็บ timestamp ระดับ pick'
  },
  { 
    field: 'employee_productivity', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'ประสิทธิภาพพนักงาน'
  },

  // === QUALITY ===
  { 
    field: 'damage_rate', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'อัตราความเสียหาย - ไม่มีการเก็บข้อมูลนี้'
  },
  { 
    field: 'return_rate', 
    table: 'N/A', 
    type: 'not_available', 
    description: 'อัตราการคืนสินค้า'
  },
];

// ============================================
// Derived Calculations (What CAN be calculated)
// ============================================

export const DERIVED_CALCULATIONS: Record<string, {
  name: string;
  nameThai: string;
  formula: string;
  requiredFields: string[];
  canCalculate: boolean;
  notes?: string;
}> = {
  available_qty: {
    name: 'Available Quantity',
    nameThai: 'จำนวนพร้อมใช้งาน',
    formula: 'total_piece_qty - reserved_piece_qty',
    requiredFields: ['total_piece_qty', 'reserved_piece_qty'],
    canCalculate: true,
  },
  reservation_percent: {
    name: 'Reservation Percentage',
    nameThai: 'เปอร์เซ็นต์การสำรอง',
    formula: '(reserved_piece_qty / total_piece_qty) * 100',
    requiredFields: ['total_piece_qty', 'reserved_piece_qty'],
    canCalculate: true,
  },
  location_utilization: {
    name: 'Location Utilization',
    nameThai: 'อัตราการใช้พื้นที่',
    formula: '(current_qty / max_capacity_qty) * 100',
    requiredFields: ['current_qty', 'max_capacity_qty'],
    canCalculate: true,
  },
  pick_progress: {
    name: 'Pick Progress',
    nameThai: 'ความคืบหน้าการจัด',
    formula: '(picked_qty / order_qty) * 100',
    requiredFields: ['picked_qty', 'order_qty'],
    canCalculate: true,
  },
  days_until_expiry: {
    name: 'Days Until Expiry',
    nameThai: 'จำนวนวันก่อนหมดอายุ',
    formula: 'expiry_date - current_date',
    requiredFields: ['expiry_date'],
    canCalculate: true,
  },
  net_movement: {
    name: 'Net Movement',
    nameThai: 'การเคลื่อนไหวสุทธิ',
    formula: 'SUM(in_qty) - SUM(out_qty)',
    requiredFields: ['piece_qty', 'direction'],
    canCalculate: true,
  },
  // CANNOT CALCULATE
  days_of_cover: {
    name: 'Days of Cover',
    nameThai: 'จำนวนวันที่สต็อกจะหมด',
    formula: 'current_stock / daily_consumption_rate',
    requiredFields: ['total_piece_qty', 'daily_consumption_rate'],
    canCalculate: false,
    notes: 'ไม่มีข้อมูล daily_consumption_rate',
  },
  reorder_suggestion: {
    name: 'Reorder Suggestion',
    nameThai: 'คำแนะนำการสั่งซื้อ',
    formula: '(reorder_point - current_stock) + safety_stock',
    requiredFields: ['reorder_point', 'safety_stock', 'total_piece_qty', 'demand_forecast'],
    canCalculate: false,
    notes: 'ไม่มีข้อมูล demand_forecast',
  },
};

// ============================================
// Export Types for Question Guidance
// ============================================

export type DataAvailability = 'available' | 'derivable' | 'not_available';

export function checkDataAvailability(fieldName: string): {
  availability: DataAvailability;
  source?: string;
  calculation?: string;
  missingDependencies?: string[];
} {
  // Check in available data
  for (const [category, fields] of Object.entries(AVAILABLE_DATA)) {
    const found = fields.find(f => f.field === fieldName);
    if (found) {
      return {
        availability: found.type === 'derived' ? 'derivable' : 'available',
        source: found.table,
        calculation: found.calculation,
      };
    }
  }

  // Check in derived calculations
  const derived = DERIVED_CALCULATIONS[fieldName];
  if (derived) {
    return {
      availability: derived.canCalculate ? 'derivable' : 'not_available',
      calculation: derived.formula,
      missingDependencies: derived.canCalculate ? undefined : derived.requiredFields.filter(f => 
        NOT_AVAILABLE_DATA.some(na => na.field === f)
      ),
    };
  }

  // Check in not available
  const notAvailable = NOT_AVAILABLE_DATA.find(f => f.field === fieldName);
  if (notAvailable) {
    return {
      availability: 'not_available',
      missingDependencies: notAvailable.dependencies,
    };
  }

  return { availability: 'not_available' };
}

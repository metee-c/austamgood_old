-- Migration: 149_create_adjustment_reasons.sql
-- Purpose: Create adjustment reason codes table
-- Date: 2025-12-15
-- Author: System Auditor

-- Step 1: Create adjustment reasons table
CREATE TABLE IF NOT EXISTS wms_adjustment_reasons (
  reason_id SERIAL PRIMARY KEY,
  reason_code VARCHAR(50) NOT NULL UNIQUE,
  reason_name_th VARCHAR(255) NOT NULL,
  reason_name_en VARCHAR(255) NOT NULL,
  reason_type VARCHAR(20) NOT NULL CHECK (reason_type IN ('increase', 'decrease', 'both')),
  requires_approval BOOLEAN DEFAULT false,
  active_status VARCHAR(20) DEFAULT 'active' CHECK (active_status IN ('active', 'inactive')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Add table comment
COMMENT ON TABLE wms_adjustment_reasons IS
  'Reason codes for stock adjustments (increase/decrease). Defines whether approval is required.';

-- Step 3: Add column comments
COMMENT ON COLUMN wms_adjustment_reasons.reason_code IS 'Unique reason code (e.g., DAMAGED, EXPIRED, FOUND)';
COMMENT ON COLUMN wms_adjustment_reasons.reason_name_th IS 'Reason name in Thai';
COMMENT ON COLUMN wms_adjustment_reasons.reason_name_en IS 'Reason name in English';
COMMENT ON COLUMN wms_adjustment_reasons.reason_type IS 'Applicable for: increase, decrease, or both';
COMMENT ON COLUMN wms_adjustment_reasons.requires_approval IS 'Whether adjustments with this reason require approval';
COMMENT ON COLUMN wms_adjustment_reasons.active_status IS 'Status: active or inactive';
COMMENT ON COLUMN wms_adjustment_reasons.display_order IS 'Display order in UI (lower = shown first)';

-- Step 4: Insert default reason codes
INSERT INTO wms_adjustment_reasons (
  reason_code,
  reason_name_th,
  reason_name_en,
  reason_type,
  requires_approval,
  display_order
) VALUES
  ('DAMAGED', 'สินค้าเสียหาย', 'Damaged Goods', 'decrease', true, 1),
  ('EXPIRED', 'สินค้าหมดอายุ', 'Expired Goods', 'decrease', true, 2),
  ('LOST', 'สินค้าสูญหาย', 'Lost/Missing', 'decrease', true, 3),
  ('FOUND', 'พบสินค้าเพิ่ม', 'Found/Surplus', 'increase', true, 4),
  ('COUNT_ERROR', 'ข้อผิดพลาดในการนับ', 'Count Error', 'both', true, 5),
  ('SYSTEM_ERROR', 'ข้อผิดพลาดของระบบ', 'System Error', 'both', true, 6),
  ('QUALITY_ISSUE', 'ปัญหาคุณภาพ', 'Quality Issue', 'decrease', true, 7),
  ('RETURN_SUPPLIER', 'คืนสินค้าให้ซัพพลายเออร์', 'Return to Supplier', 'decrease', false, 8),
  ('SAMPLE', 'ตัวอย่างสินค้า', 'Sample', 'decrease', false, 9),
  ('INITIAL', 'ยอดยกมา', 'Initial Stock', 'increase', false, 10),
  ('TRANSFER_IN', 'รับโอนจากคลังอื่น', 'Transfer In', 'increase', false, 11),
  ('TRANSFER_OUT', 'โอนไปคลังอื่น', 'Transfer Out', 'decrease', false, 12),
  ('OTHER', 'อื่นๆ (ระบุใน remarks)', 'Other (see remarks)', 'both', true, 99)
ON CONFLICT (reason_code) DO NOTHING; -- Prevent duplicate if migration runs multiple times

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adjustment_reasons_active
ON wms_adjustment_reasons(active_status)
WHERE active_status = 'active';

CREATE INDEX IF NOT EXISTS idx_adjustment_reasons_type
ON wms_adjustment_reasons(reason_type);

CREATE INDEX IF NOT EXISTS idx_adjustment_reasons_display_order
ON wms_adjustment_reasons(display_order);

-- Step 6: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_wms_adjustment_reasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_adjustment_reasons_updated_at
  BEFORE UPDATE ON wms_adjustment_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_wms_adjustment_reasons_updated_at();

-- Verification query (for testing)
-- SELECT reason_id, reason_code, reason_name_th, reason_type, requires_approval, active_status
-- FROM wms_adjustment_reasons
-- ORDER BY display_order;

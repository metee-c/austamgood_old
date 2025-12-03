-- Migration: 101_enhance_bonus_face_sheets.sql
-- Description: เพิ่ม columns สำหรับติดตามพนักงานและเวลาในกระบวนการหยิบสินค้า
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Stock Reservation System

-- Add new columns for employee tracking and picking timestamps
ALTER TABLE bonus_face_sheets
  ADD COLUMN IF NOT EXISTS checker_employee_ids BIGINT[],
  ADD COLUMN IF NOT EXISTS picker_employee_ids BIGINT[],
  ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS picking_completed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for querying by employee
CREATE INDEX IF NOT EXISTS idx_bonus_face_sheets_checker_employees
  ON bonus_face_sheets USING GIN(checker_employee_ids);

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheets_picker_employees
  ON bonus_face_sheets USING GIN(picker_employee_ids);

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheets_picking_started
  ON bonus_face_sheets(picking_started_at)
  WHERE picking_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheets_picking_completed
  ON bonus_face_sheets(picking_completed_at)
  WHERE picking_completed_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN bonus_face_sheets.checker_employee_ids IS 'รายการ employee_id ของพนักงานเช็คสินค้า (array) - บันทึกเมื่อหยิบครบ';
COMMENT ON COLUMN bonus_face_sheets.picker_employee_ids IS 'รายการ employee_id ของพนักงานจัดสินค้า (array) - บันทึกเมื่อหยิบครบ';
COMMENT ON COLUMN bonus_face_sheets.picking_started_at IS 'วันเวลาที่เริ่มหยิบสินค้า - อัปเดตเมื่อเริ่มหยิบรายการแรก';
COMMENT ON COLUMN bonus_face_sheets.picking_completed_at IS 'วันเวลาที่หยิบเสร็จทั้งหมด - อัปเดตเมื่อหยิบครบทุกรายการ';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 101 completed: Enhanced bonus_face_sheets with employee tracking columns';
END $$;

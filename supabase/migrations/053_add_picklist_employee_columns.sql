-- ============================================================================
-- Migration: Add checker and picker employee columns to picklists
-- Description: เพิ่ม columns สำหรับเก็บข้อมูลพนักงานเช็คและพนักงานจัดสินค้า
-- ============================================================================

-- Add checker_employee_ids column (array of employee IDs)
ALTER TABLE picklists
ADD COLUMN IF NOT EXISTS checker_employee_ids bigint[];

-- Add picker_employee_ids column (array of employee IDs)
ALTER TABLE picklists
ADD COLUMN IF NOT EXISTS picker_employee_ids bigint[];

-- Add comments
COMMENT ON COLUMN picklists.checker_employee_ids IS 'รายการ employee_id ของพนักงานเช็ค (array)';
COMMENT ON COLUMN picklists.picker_employee_ids IS 'รายการ employee_id ของพนักงานจัดสินค้า (array)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_picklists_checker_employees ON picklists USING GIN (checker_employee_ids);
CREATE INDEX IF NOT EXISTS idx_picklists_picker_employees ON picklists USING GIN (picker_employee_ids);

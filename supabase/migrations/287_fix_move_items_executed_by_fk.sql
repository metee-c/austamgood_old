-- Migration 287: Fix wms_move_items executed_by foreign key
-- Problem: executed_by references master_employee but should reference master_system_user
-- Date: 2026-01-22

-- Drop the old foreign key constraint
ALTER TABLE wms_move_items
DROP CONSTRAINT IF EXISTS fk_move_items_executed_by;

-- Add new foreign key constraint to master_system_user
ALTER TABLE wms_move_items
ADD CONSTRAINT fk_move_items_executed_by 
FOREIGN KEY (executed_by) 
REFERENCES master_system_user(user_id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT fk_move_items_executed_by ON wms_move_items IS 
'Foreign key to master_system_user.user_id (changed from master_employee.employee_id in migration 287)';

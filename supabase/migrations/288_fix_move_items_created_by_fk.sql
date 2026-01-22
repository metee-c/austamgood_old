-- Migration 288: Fix wms_move_items created_by foreign key
-- Problem: created_by references master_employee but should reference master_system_user
-- Issue: Users other than metee.c@buzzpetsfood.com cannot create move items
-- Error: "insert or update on table wms_move_items violates foreign key constraint fk_move_items_created_by"
-- Date: 2026-01-22

-- Drop the old foreign key constraint
ALTER TABLE wms_move_items
DROP CONSTRAINT IF EXISTS fk_move_items_created_by;

-- Add new foreign key constraint to master_system_user
ALTER TABLE wms_move_items
ADD CONSTRAINT fk_move_items_created_by 
FOREIGN KEY (created_by) 
REFERENCES master_system_user(user_id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT fk_move_items_created_by ON wms_move_items IS 
'Foreign key to master_system_user.user_id (changed from master_employee.employee_id in migration 288)';

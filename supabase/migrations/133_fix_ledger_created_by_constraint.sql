-- ============================================================================
-- Migration: Fix created_by foreign key constraint
-- Description: Change created_by to reference master_system_user instead of master_employee
-- ============================================================================

-- Drop old foreign key constraint
ALTER TABLE wms_inventory_ledger
DROP CONSTRAINT IF EXISTS fk_inventory_ledger_created_by;

-- Add new foreign key constraint to master_system_user
ALTER TABLE wms_inventory_ledger
ADD CONSTRAINT fk_inventory_ledger_created_by
FOREIGN KEY (created_by)
REFERENCES master_system_user(user_id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT fk_inventory_ledger_created_by ON wms_inventory_ledger IS 
'Foreign key to master_system_user for tracking who created the ledger entry';

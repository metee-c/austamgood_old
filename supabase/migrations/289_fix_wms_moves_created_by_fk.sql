-- Migration 289: Fix wms_moves.created_by FK to point to master_system_user
-- Issue: wms_moves.created_by still points to master_employee.employee_id
-- Should point to: master_system_user.user_id

-- Step 1: Drop old FK constraint
ALTER TABLE wms_moves 
DROP CONSTRAINT IF EXISTS fk_wms_moves_created_by;

-- Step 2: Update existing data - map employee_id to user_id
-- For records where created_by is an employee_id, find the corresponding user_id
UPDATE wms_moves m
SET created_by = u.user_id
FROM master_system_user u
WHERE m.created_by = u.employee_id
  AND m.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_system_user WHERE user_id = m.created_by
  );

-- Step 3: Set NULL for any remaining invalid references
UPDATE wms_moves
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_system_user WHERE user_id = created_by
  );

-- Step 4: Add new FK constraint pointing to master_system_user.user_id
ALTER TABLE wms_moves
ADD CONSTRAINT fk_wms_moves_created_by
FOREIGN KEY (created_by) 
REFERENCES master_system_user(user_id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON CONSTRAINT fk_wms_moves_created_by ON wms_moves IS 
'FK to master_system_user.user_id (not employee_id) - Fixed in Migration 289';

-- ==========================================
-- Migration: 126_add_role_id_to_master_system_user.sql
-- Description: Add role_id and is_locked columns to master_system_user
-- Author: System
-- Date: 2024-12-07
-- Dependencies: 118_enhance_master_system_user_for_auth.sql
-- ==========================================

-- Add role_id column
ALTER TABLE master_system_user 
ADD COLUMN IF NOT EXISTS role_id BIGINT;

-- Add is_locked column
ALTER TABLE master_system_user 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Add foreign key constraint to master_system_role
ALTER TABLE master_system_user 
DROP CONSTRAINT IF EXISTS fk_master_system_user_role;

ALTER TABLE master_system_user 
ADD CONSTRAINT fk_master_system_user_role 
FOREIGN KEY (role_id) REFERENCES master_system_role(role_id);

-- Create index for role_id
CREATE INDEX IF NOT EXISTS idx_master_system_user_role_id 
ON master_system_user(role_id);

-- Add comments
COMMENT ON COLUMN master_system_user.role_id IS 'Foreign key to master_system_role table';
COMMENT ON COLUMN master_system_user.is_locked IS 'Whether the account is currently locked';

-- Update existing users with default role (if needed)
-- You may want to set a specific default role_id here
-- For now, we'll leave it NULL and let the application handle it

-- Summary
DO $$
BEGIN
    RAISE NOTICE '=== Added role_id and is_locked to master_system_user ===';
    RAISE NOTICE 'Added columns: role_id (BIGINT), is_locked (BOOLEAN)';
    RAISE NOTICE 'Created foreign key constraint to master_system_role';
    RAISE NOTICE 'Created index on role_id';
END $$;

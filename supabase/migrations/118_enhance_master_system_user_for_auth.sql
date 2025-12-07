-- ==========================================
-- Migration: 118_enhance_master_system_user_for_auth.sql
-- Description: Enhance master_system_user table with authentication fields
-- Author: System
-- Date: 2024-12-07
-- Dependencies: 115_add_new_permission_structure.sql
-- ==========================================

-- Add authentication-related columns to master_system_user table
ALTER TABLE master_system_user 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add constraints (drop first if exists to avoid errors)
DO $$ 
BEGIN
    ALTER TABLE master_system_user DROP CONSTRAINT IF EXISTS chk_master_system_user_failed_attempts;
    ALTER TABLE master_system_user ADD CONSTRAINT chk_master_system_user_failed_attempts 
        CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 100);
    
    ALTER TABLE master_system_user DROP CONSTRAINT IF EXISTS chk_master_system_user_locked_until_future;
    ALTER TABLE master_system_user ADD CONSTRAINT chk_master_system_user_locked_until_future 
        CHECK (locked_until IS NULL OR locked_until > CURRENT_TIMESTAMP);
    
    ALTER TABLE master_system_user DROP CONSTRAINT IF EXISTS chk_master_system_user_password_changed_consistency;
    ALTER TABLE master_system_user ADD CONSTRAINT chk_master_system_user_password_changed_consistency 
        CHECK (password_changed_at <= CURRENT_TIMESTAMP);
END $$;

-- Add comments
COMMENT ON COLUMN master_system_user.password_hash IS 'Hashed password using bcrypt or similar';
COMMENT ON COLUMN master_system_user.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN master_system_user.locked_until IS 'Account locked until this timestamp (NULL = not locked)';
COMMENT ON COLUMN master_system_user.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN master_system_user.password_changed_at IS 'When password was last changed';
COMMENT ON COLUMN master_system_user.force_password_change IS 'Force user to change password on next login';
COMMENT ON COLUMN master_system_user.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN master_system_user.two_factor_secret IS 'TOTP secret for 2FA (encrypted)';
COMMENT ON COLUMN master_system_user.email_verified IS 'Whether email address has been verified';
COMMENT ON COLUMN master_system_user.email_verification_token IS 'Token for email verification';
COMMENT ON COLUMN master_system_user.created_at IS 'User account creation timestamp';
COMMENT ON COLUMN master_system_user.updated_at IS 'User account last update timestamp';

-- Create indexes for authentication queries
CREATE INDEX IF NOT EXISTS idx_master_system_user_email_active 
    ON master_system_user(email) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_master_system_user_username_active 
    ON master_system_user(username) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_master_system_user_locked_until 
    ON master_system_user(locked_until) WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_system_user_failed_attempts 
    ON master_system_user(failed_login_attempts) WHERE failed_login_attempts > 0;

CREATE INDEX IF NOT EXISTS idx_master_system_user_last_login 
    ON master_system_user(last_login_at);

CREATE INDEX IF NOT EXISTS idx_master_system_user_password_changed 
    ON master_system_user(password_changed_at);

CREATE INDEX IF NOT EXISTS idx_master_system_user_email_verification 
    ON master_system_user(email_verification_token) WHERE email_verification_token IS NOT NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_master_system_user_updated_at ON master_system_user;
CREATE TRIGGER trigger_master_system_user_updated_at
    BEFORE UPDATE ON master_system_user
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    locked_until_time TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT locked_until INTO locked_until_time
    FROM master_system_user
    WHERE user_id = p_user_id;
    
    RETURN locked_until_time IS NOT NULL AND locked_until_time > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to unlock account
CREATE OR REPLACE FUNCTION unlock_account(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE master_system_user 
    SET 
        locked_until = NULL,
        failed_login_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to lock account
CREATE OR REPLACE FUNCTION lock_account(
    p_user_id INTEGER,
    p_lock_duration_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE master_system_user 
    SET 
        locked_until = CURRENT_TIMESTAMP + INTERVAL '1 minute' * p_lock_duration_minutes,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment failed login attempts
CREATE OR REPLACE FUNCTION increment_failed_login_attempts(
    p_user_id INTEGER,
    p_max_attempts INTEGER DEFAULT 5,
    p_lock_duration_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    new_attempt_count INTEGER;
    should_lock BOOLEAN := false;
BEGIN
    -- Increment failed attempts
    UPDATE master_system_user 
    SET 
        failed_login_attempts = failed_login_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id
    RETURNING failed_login_attempts INTO new_attempt_count;
    
    -- Check if account should be locked
    IF new_attempt_count >= p_max_attempts THEN
        UPDATE master_system_user 
        SET 
            locked_until = CURRENT_TIMESTAMP + INTERVAL '1 minute' * p_lock_duration_minutes,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id;
        should_lock := true;
    END IF;
    
    RETURN should_lock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset failed login attempts
CREATE OR REPLACE FUNCTION reset_failed_login_attempts(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE master_system_user 
    SET 
        failed_login_attempts = 0,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION is_account_locked(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_account(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_account(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_failed_login_attempts(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_failed_login_attempts(INTEGER) TO authenticated;

-- Update existing users with default values
UPDATE master_system_user 
SET 
    password_changed_at = COALESCE(password_changed_at, created_at, CURRENT_TIMESTAMP),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
WHERE password_changed_at IS NULL OR created_at IS NULL OR updated_at IS NULL;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '=== master_system_user Enhanced for Authentication ===';
    RAISE NOTICE 'Added columns: password_hash, failed_login_attempts, locked_until, etc.';
    RAISE NOTICE 'Created functions: is_account_locked, unlock_account, lock_account, etc.';
    RAISE NOTICE 'Created indexes for authentication queries';
END $$;

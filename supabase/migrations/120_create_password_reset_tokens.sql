-- Migration 120: Password reset tokens table
-- Dependencies: 118_enhance_master_system_user_for_auth.sql

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES master_system_user(user_id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    
    CONSTRAINT chk_reset_expired_future CHECK (expired_at > created_at),
    CONSTRAINT chk_reset_used_valid CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE UNIQUE INDEX idx_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_unused ON password_reset_tokens(user_id, expired_at) WHERE used_at IS NULL;

-- Create reset token
CREATE OR REPLACE FUNCTION create_reset_token(
    p_user_id INTEGER,
    p_token VARCHAR(64),
    p_duration_hours INTEGER DEFAULT 1
) RETURNS UUID AS $$
DECLARE
    v_token_id UUID;
BEGIN
    -- Invalidate existing tokens
    UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND used_at IS NULL;
    
    -- Create new token
    INSERT INTO password_reset_tokens (user_id, token, expired_at)
    VALUES (p_user_id, p_token, CURRENT_TIMESTAMP + INTERVAL '1 hour' * p_duration_hours)
    RETURNING token_id INTO v_token_id;
    
    RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate reset token
CREATE OR REPLACE FUNCTION validate_reset_token(p_token VARCHAR(64))
RETURNS TABLE (user_id INTEGER, is_valid BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT prt.user_id,
           (prt.used_at IS NULL AND prt.expired_at > CURRENT_TIMESTAMP AND u.is_active = true) as is_valid
    FROM password_reset_tokens prt
    JOIN master_system_user u ON prt.user_id = u.user_id
    WHERE prt.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use reset token
CREATE OR REPLACE FUNCTION use_reset_token(
    p_token VARCHAR(64),
    p_new_password_hash VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id INTEGER;
    v_valid BOOLEAN;
BEGIN
    SELECT user_id, is_valid INTO v_user_id, v_valid FROM validate_reset_token(p_token);
    
    IF NOT v_valid OR v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Update password
    UPDATE master_system_user 
    SET password_hash = p_new_password_hash,
        password_changed_at = CURRENT_TIMESTAMP,
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE user_id = v_user_id;
    
    -- Mark token as used
    UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = p_token;
    
    -- Invalidate all sessions
    UPDATE user_sessions SET invalidated = true, invalidated_at = CURRENT_TIMESTAMP
    WHERE user_id = v_user_id AND invalidated = false;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION create_reset_token TO authenticated;
GRANT EXECUTE ON FUNCTION validate_reset_token TO authenticated;
GRANT EXECUTE ON FUNCTION use_reset_token TO authenticated;

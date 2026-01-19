-- Migration 245: Fix session functions and extend session duration
-- Fix missing functions and improve session management

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS validate_session_token(VARCHAR);
DROP FUNCTION IF EXISTS update_session_activity_by_token(VARCHAR);
DROP FUNCTION IF EXISTS invalidate_session(VARCHAR, INTEGER);

-- Create validate_session_token function (used by lib/auth/session.ts)
CREATE OR REPLACE FUNCTION validate_session_token(p_token VARCHAR(128))
RETURNS TABLE (
    session_id UUID,
    user_id INTEGER,
    username VARCHAR(50),
    email VARCHAR(255),
    full_name VARCHAR(255),
    is_valid BOOLEAN,
    expires_in_seconds INTEGER,
    last_activity_minutes_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.session_id,
        s.user_id,
        u.username,
        u.email,
        u.full_name,
        (s.invalidated = false AND s.expired_at > CURRENT_TIMESTAMP AND u.is_active = true) as is_valid,
        GREATEST(0, EXTRACT(EPOCH FROM (s.expired_at - CURRENT_TIMESTAMP))::INTEGER) as expires_in_seconds,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.last_activity_at))::INTEGER / 60 as last_activity_minutes_ago
    FROM user_sessions s
    JOIN master_system_user u ON s.user_id = u.user_id
    WHERE s.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create update_session_activity_by_token function
CREATE OR REPLACE FUNCTION update_session_activity_by_token(p_token VARCHAR(128))
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN;
    v_idle_timeout_minutes INTEGER := 30; -- Default idle timeout
    v_new_expired_at TIMESTAMPTZ;
BEGIN
    -- Get idle timeout from settings (if exists)
    BEGIN
        SELECT setting_value::INTEGER INTO v_idle_timeout_minutes
        FROM system_settings
        WHERE setting_key = 'auth.session_idle_timeout_minutes';
    EXCEPTION WHEN OTHERS THEN
        v_idle_timeout_minutes := 30; -- Fallback to default
    END;
    
    -- Calculate new expiry time: current time + idle timeout
    v_new_expired_at := CURRENT_TIMESTAMP + (v_idle_timeout_minutes || ' minutes')::INTERVAL;
    
    -- Update last_activity_at and extend expired_at
    UPDATE user_sessions 
    SET 
        last_activity_at = CURRENT_TIMESTAMP,
        expired_at = GREATEST(expired_at, v_new_expired_at) -- Extend expiry if needed
    WHERE token = p_token 
      AND invalidated = false
      AND expired_at > CURRENT_TIMESTAMP;
    
    v_updated := FOUND;
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved invalidate_session function with optional invalidated_by parameter
CREATE OR REPLACE FUNCTION invalidate_session(
    p_token VARCHAR(128),
    p_invalidated_by INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_invalidated BOOLEAN;
BEGIN
    UPDATE user_sessions 
    SET 
        invalidated = true,
        invalidated_at = CURRENT_TIMESTAMP,
        invalidated_by = p_invalidated_by
    WHERE token = p_token 
      AND invalidated = false;
    
    v_invalidated := FOUND;
    RETURN v_invalidated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_session_token TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_activity_by_token TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_session TO authenticated;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_active 
ON user_sessions(token) 
WHERE invalidated = false;

-- Add comments
COMMENT ON FUNCTION validate_session_token IS 'Validate session token and return user info with expiry details';
COMMENT ON FUNCTION update_session_activity_by_token IS 'Update session activity timestamp and extend expiry time based on idle timeout';
COMMENT ON FUNCTION invalidate_session IS 'Invalidate a session by token';

-- Migration 119: Sessions table for user session management
-- Dependencies: 118_enhance_master_system_user_for_auth.sql

CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES master_system_user(user_id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    invalidated BOOLEAN DEFAULT false,
    invalidated_at TIMESTAMPTZ,
    invalidated_by INTEGER REFERENCES master_system_user(user_id),
    
    CONSTRAINT chk_sessions_expired_future CHECK (expired_at > created_at),
    CONSTRAINT chk_sessions_activity_valid CHECK (last_activity_at >= created_at),
    CONSTRAINT chk_sessions_invalidated CHECK (
        (invalidated = false AND invalidated_at IS NULL) OR
        (invalidated = true AND invalidated_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expired_at ON sessions(expired_at);
CREATE INDEX idx_sessions_active ON sessions(user_id, expired_at) WHERE invalidated = false;

-- Create session
CREATE OR REPLACE FUNCTION create_session(
    p_user_id INTEGER,
    p_token VARCHAR(128),
    p_duration_hours INTEGER DEFAULT 24,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO sessions (user_id, token, expired_at, ip_address, user_agent)
    VALUES (p_user_id, p_token, CURRENT_TIMESTAMP + INTERVAL '1 hour' * p_duration_hours, p_ip_address, p_user_agent)
    RETURNING session_id INTO v_session_id;
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate session
CREATE OR REPLACE FUNCTION validate_session(p_token VARCHAR(128))
RETURNS TABLE (
    session_id UUID,
    user_id INTEGER,
    username VARCHAR(50),
    email VARCHAR(255),
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.session_id, s.user_id, u.username, u.email,
           (s.invalidated = false AND s.expired_at > CURRENT_TIMESTAMP AND u.is_active = true) as is_valid
    FROM sessions s
    JOIN master_system_user u ON s.user_id = u.user_id
    WHERE s.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invalidate session
CREATE OR REPLACE FUNCTION invalidate_session(p_token VARCHAR(128))
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sessions SET invalidated = true, invalidated_at = CURRENT_TIMESTAMP
    WHERE token = p_token AND invalidated = false;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT, UPDATE ON sessions TO authenticated;
GRANT EXECUTE ON FUNCTION create_session TO authenticated;
GRANT EXECUTE ON FUNCTION validate_session TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_session TO authenticated;

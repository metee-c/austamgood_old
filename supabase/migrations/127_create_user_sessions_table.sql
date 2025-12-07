-- ==========================================
-- Migration: 127_create_user_sessions_table.sql
-- Description: Create user_sessions table (separate from Supabase Auth sessions)
-- Author: System
-- Date: 2024-12-07
-- Dependencies: 118_enhance_master_system_user_for_auth.sql
-- ==========================================

-- Drop old functions first
DROP FUNCTION IF EXISTS create_session CASCADE;
DROP FUNCTION IF EXISTS validate_session CASCADE;
DROP FUNCTION IF EXISTS validate_session_token CASCADE;
DROP FUNCTION IF EXISTS update_session_activity_by_token CASCADE;
DROP FUNCTION IF EXISTS invalidate_session CASCADE;

-- Drop old sessions table if exists (it conflicts with Supabase Auth)
DROP TABLE IF EXISTS sessions CASCADE;

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
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
    
    CONSTRAINT chk_user_sessions_expired_future CHECK (expired_at > created_at)
);

-- Create indexes
CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expired_at ON user_sessions(expired_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, expired_at) WHERE invalidated = false;

-- Create session function
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
    INSERT INTO user_sessions (user_id, token, expired_at, ip_address, user_agent)
    VALUES (p_user_id, p_token, CURRENT_TIMESTAMP + INTERVAL '1 hour' * p_duration_hours, p_ip_address, p_user_agent)
    RETURNING session_id INTO v_session_id;
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate session function
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
        EXTRACT(EPOCH FROM (s.expired_at - CURRENT_TIMESTAMP))::INTEGER as expires_in_seconds,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.last_activity_at))::INTEGER / 60 as last_activity_minutes_ago
    FROM user_sessions s
    JOIN master_system_user u ON s.user_id = u.user_id
    WHERE s.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update session activity function
CREATE OR REPLACE FUNCTION update_session_activity_by_token(p_token VARCHAR(128))
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_sessions 
    SET last_activity_at = CURRENT_TIMESTAMP
    WHERE token = p_token AND invalidated = false AND expired_at > CURRENT_TIMESTAMP;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invalidate session function
CREATE OR REPLACE FUNCTION invalidate_session(
    p_token VARCHAR(128),
    p_invalidated_by INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_sessions 
    SET 
        invalidated = true, 
        invalidated_at = CURRENT_TIMESTAMP,
        invalidated_by = p_invalidated_by
    WHERE token = p_token AND invalidated = false;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_session TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_session_token TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_session_activity_by_token TO authenticated, anon;
GRANT EXECUTE ON FUNCTION invalidate_session TO authenticated, anon;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '=== User Sessions Table Created ===';
    RAISE NOTICE 'Created table: user_sessions';
    RAISE NOTICE 'Created functions: create_session, validate_session_token, update_session_activity_by_token, invalidate_session';
END $$;

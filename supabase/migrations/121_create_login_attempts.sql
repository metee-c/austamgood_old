-- Migration 121: Login attempts table for security monitoring
-- Dependencies: 119_create_sessions_table.sql

CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES master_system_user(user_id),
    ip_address INET,
    user_agent TEXT,
    attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    session_id UUID REFERENCES sessions(session_id),
    
    CONSTRAINT chk_attempts_success CHECK (
        (success = true AND failure_reason IS NULL) OR
        (success = false AND failure_reason IS NOT NULL)
    )
);

CREATE INDEX idx_attempts_email ON login_attempts(email);
CREATE INDEX idx_attempts_user_id ON login_attempts(user_id);
CREATE INDEX idx_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX idx_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_attempts_failed ON login_attempts(email, attempted_at) WHERE success = false;

-- Log login attempt
CREATE OR REPLACE FUNCTION log_login_attempt(
    p_email VARCHAR(255),
    p_user_id INTEGER DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_success BOOLEAN DEFAULT false,
    p_failure_reason VARCHAR(100) DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
BEGIN
    INSERT INTO login_attempts (email, user_id, ip_address, success, failure_reason, session_id)
    VALUES (p_email, p_user_id, p_ip_address, p_success, p_failure_reason, p_session_id)
    RETURNING attempt_id INTO v_attempt_id;
    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_email VARCHAR(255),
    p_ip_address INET,
    p_window_minutes INTEGER DEFAULT 60,
    p_max_attempts INTEGER DEFAULT 10
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM login_attempts
    WHERE (email = p_email OR ip_address = p_ip_address)
      AND success = false
      AND attempted_at > (CURRENT_TIMESTAMP - INTERVAL '1 minute' * p_window_minutes);
    
    RETURN v_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT ON login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION log_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;

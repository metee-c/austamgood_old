-- Migration 123: Audit logs table for tracking user actions
-- Dependencies: 118_enhance_master_system_user_for_auth.sql

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES master_system_user(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    session_id UUID REFERENCES sessions(session_id)
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_session_id ON audit_logs(session_id);

-- Log audit entry
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id INTEGER,
    p_action VARCHAR(100),
    p_entity_type VARCHAR(100) DEFAULT NULL,
    p_entity_id VARCHAR(100) DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, session_id)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values, p_ip_address, p_session_id)
    RETURNING log_id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user audit trail
CREATE OR REPLACE FUNCTION get_user_audit_trail(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    log_id UUID,
    action VARCHAR(100),
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT al.log_id, al.action, al.entity_type, al.entity_id, al.created_at
    FROM audit_logs al
    WHERE al.user_id = p_user_id
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_audit_trail TO authenticated;

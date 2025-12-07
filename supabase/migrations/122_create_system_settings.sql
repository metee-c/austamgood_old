-- Migration 122: System settings table for configurable parameters
-- Dependencies: 118_enhance_master_system_user_for_auth.sql

-- Drop table if exists to recreate with correct constraint
DROP TABLE IF EXISTS system_settings CASCADE;

CREATE TABLE system_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES master_system_user(user_id),
    
    CONSTRAINT chk_settings_type CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    CONSTRAINT chk_settings_key_format CHECK (setting_key ~ '^[a-z]+[.][a-z_]+$')
);

CREATE UNIQUE INDEX idx_settings_key ON system_settings(setting_key);
CREATE INDEX idx_settings_type ON system_settings(setting_type);

CREATE TRIGGER trigger_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Get setting functions
CREATE OR REPLACE FUNCTION get_system_setting(
    p_key VARCHAR(100),
    p_default TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT setting_value INTO v_value FROM system_settings WHERE setting_key = p_key;
    RETURN COALESCE(v_value, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_system_setting_int(
    p_key VARCHAR(100),
    p_default INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT setting_value INTO v_value FROM system_settings 
    WHERE setting_key = p_key AND setting_type = 'number';
    RETURN COALESCE(v_value::INTEGER, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_system_setting_bool(
    p_key VARCHAR(100),
    p_default BOOLEAN DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT setting_value INTO v_value FROM system_settings 
    WHERE setting_key = p_key AND setting_type = 'boolean';
    RETURN COALESCE(v_value::BOOLEAN, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update setting
CREATE OR REPLACE FUNCTION update_system_setting(
    p_key VARCHAR(100),
    p_value TEXT,
    p_updated_by INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE system_settings 
    SET setting_value = p_value, updated_by = p_updated_by, updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = p_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON system_settings TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_setting TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_setting_int TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_setting_bool TO authenticated;
GRANT EXECUTE ON FUNCTION update_system_setting TO authenticated;

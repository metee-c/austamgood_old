-- Migration 124: Insert default system settings for authentication
-- Dependencies: 122_create_system_settings.sql

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
-- Authentication settings (format: module.setting_name)
('auth.session_duration', '24', 'number', 'Default session duration in hours'),
('auth.max_sessions', '5', 'number', 'Maximum concurrent sessions per user'),
('auth.idle_timeout', '120', 'number', 'Idle timeout in minutes (0 = disabled)'),
('auth.max_attempts', '5', 'number', 'Maximum failed login attempts before lock'),
('auth.lock_duration', '15', 'number', 'Account lock duration in minutes'),
('auth.password_min', '8', 'number', 'Minimum password length'),
('auth.require_uppercase', 'true', 'boolean', 'Require uppercase letter in password'),
('auth.require_lowercase', 'true', 'boolean', 'Require lowercase letter in password'),
('auth.require_number', 'true', 'boolean', 'Require number in password'),
('auth.require_special', 'false', 'boolean', 'Require special character in password'),
('auth.password_expiry', '90', 'number', 'Password expiry in days (0 = never)'),
('auth.reset_duration', '1', 'number', 'Password reset token duration in hours'),
('auth.reset_limit', '3', 'number', 'Max password reset requests per hour'),
('auth.rate_window', '60', 'number', 'Rate limit time window in minutes'),
('auth.rate_attempts', '10', 'number', 'Max login attempts in time window'),
('auth.two_factor', 'false', 'boolean', 'Enable two-factor authentication'),
('auth.session_cleanup', '7', 'number', 'Delete expired sessions after N days'),
('auth.audit_retention', '365', 'number', 'Keep audit logs for N days'),

-- System settings
('system.maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('system.allow_registration', 'false', 'boolean', 'Allow new user registration'),
('system.default_role', '1', 'number', 'Default role ID for new users')

ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Summary
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM system_settings;
    RAISE NOTICE '=== Default System Settings Inserted ===';
    RAISE NOTICE 'Total settings: %', v_count;
    RAISE NOTICE 'Authentication system ready!';
END $$;

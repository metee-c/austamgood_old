-- Fix use_reset_token function to use user_sessions instead of sessions table
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

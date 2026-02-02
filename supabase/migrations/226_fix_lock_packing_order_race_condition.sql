 -- ============================================================================
-- Migration 226: Fix Race Condition in lock_packing_order
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_packing_order(
    p_tracking_number VARCHAR,
    p_session_id VARCHAR,
    p_device_info VARCHAR DEFAULT NULL,
    p_timeout_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(
    success BOOLEAN,
    locked_by VARCHAR,
    locked_at TIMESTAMP WITH TIME ZONE,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_expires_at TIMESTAMP WITH TIME ZONE := v_now + (p_timeout_seconds || ' seconds')::INTERVAL;
    v_existing RECORD;
    v_lock_key BIGINT;
BEGIN
    v_lock_key := hashtext(p_tracking_number)::BIGINT;
    PERFORM pg_advisory_xact_lock(v_lock_key);
    
    DELETE FROM packing_order_locks 
    WHERE expires_at < v_now AND status = 'active';
    
    SELECT * INTO v_existing 
    FROM packing_order_locks 
    WHERE tracking_number = p_tracking_number
    AND status = 'active'
    AND expires_at > v_now
    FOR UPDATE;
    
    IF v_existing IS NOT NULL THEN
        IF v_existing.locked_by_session = p_session_id THEN
            UPDATE packing_order_locks 
            SET expires_at = v_expires_at
            WHERE tracking_number = p_tracking_number;
            
            RETURN QUERY SELECT 
                TRUE, v_existing.locked_by_session, v_existing.locked_at, 'Lock extended'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                FALSE, v_existing.locked_by_session, v_existing.locked_at,
                format('ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น (%s)', COALESCE(v_existing.locked_by_device, 'ไม่ทราบ'))::TEXT;
            RETURN;
        END IF;
    END IF;
    
    INSERT INTO packing_order_locks (
        tracking_number, locked_by_session, locked_by_device, locked_at, expires_at, status
    )
    VALUES (p_tracking_number, p_session_id, p_device_info, v_now, v_expires_at, 'active')
    ON CONFLICT (tracking_number) DO UPDATE SET
        locked_by_session = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_by_session ELSE packing_order_locks.locked_by_session END,
        locked_by_device = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_by_device ELSE packing_order_locks.locked_by_device END,
        locked_at = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_at ELSE packing_order_locks.locked_at END,
        expires_at = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.expires_at
            WHEN packing_order_locks.locked_by_session = p_session_id
            THEN EXCLUDED.expires_at ELSE packing_order_locks.expires_at END,
        status = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN 'active' ELSE packing_order_locks.status END;
    
    SELECT * INTO v_existing FROM packing_order_locks WHERE tracking_number = p_tracking_number;
    
    IF v_existing.locked_by_session = p_session_id THEN
        RETURN QUERY SELECT TRUE, p_session_id, v_existing.locked_at, 'Lock acquired'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, v_existing.locked_by_session, v_existing.locked_at,
            format('ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น (%s)', COALESCE(v_existing.locked_by_device, 'ไม่ทราบ'))::TEXT;
    END IF;
END;
$$;
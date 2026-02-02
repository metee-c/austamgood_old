-- ============================================================================
-- Migration 226: Fix Race Condition in lock_packing_order
-- ============================================================================
-- ปัญหา: ถ้า 2 requests มาพร้อมกัน ทั้งคู่อาจเห็นว่าไม่มี lock แล้ว insert พร้อมกัน
-- แก้ไข: ใช้ INSERT ... ON CONFLICT และ advisory lock
-- ============================================================================

-- Drop and recreate the function with proper locking
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
    -- สร้าง advisory lock key จาก tracking_number
    v_lock_key := hashtext(p_tracking_number)::BIGINT;
    
    -- ใช้ advisory lock เพื่อป้องกัน race condition
    PERFORM pg_advisory_xact_lock(v_lock_key);
    
    -- ลบ lock ที่หมดอายุ
    DELETE FROM packing_order_locks 
    WHERE expires_at < v_now 
    AND status = 'active';
    
    -- เช็คว่ามี active lock อยู่แล้วหรือไม่ (ใช้ FOR UPDATE)
    SELECT * INTO v_existing 
    FROM packing_order_locks 
    WHERE tracking_number = p_tracking_number
    AND status = 'active'
    AND expires_at > v_now
    FOR UPDATE;
    
    IF v_existing IS NOT NULL THEN
        -- ถ้าเป็น session เดียวกัน → extend lock
        IF v_existing.locked_by_session = p_session_id THEN
            UPDATE packing_order_locks 
            SET expires_at = v_expires_at
            WHERE tracking_number = p_tracking_number;
            
            RETURN QUERY SELECT 
                TRUE,
                v_existing.locked_by_session,
                v_existing.locked_at,
                'Lock extended'::TEXT;
            RETURN;
        ELSE
            -- ถูก lock โดยคนอื่น
            RETURN QUERY SELECT 
                FALSE,
                v_existing.locked_by_session,
                v_existing.locked_at,
                format('ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น (%s)', COALESCE(v_existing.locked_by_device, 'ไม่ทราบ'))::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- ไม่มี active lock → ลอง insert ใหม่ด้วย ON CONFLICT
    INSERT INTO packing_order_locks (
        tracking_number, 
        locked_by_session, 
        locked_by_device, 
        locked_at, 
        expires_at,
        status
    )
    VALUES (
        p_tracking_number, 
        p_session_id, 
        p_device_info, 
        v_now, 
        v_expires_at,
        'active'
    )
    ON CONFLICT (tracking_number) DO UPDATE SET
        -- ถ้ามี conflict ให้เช็คว่า lock เดิมหมดอายุหรือไม่
        locked_by_session = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_by_session 
            ELSE packing_order_locks.locked_by_session 
        END,
        locked_by_device = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_by_device 
            ELSE packing_order_locks.locked_by_device 
        END,
        locked_at = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.locked_at 
            ELSE packing_order_locks.locked_at 
        END,
        expires_at = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN EXCLUDED.expires_at
            WHEN packing_order_locks.locked_by_session = p_session_id
            THEN EXCLUDED.expires_at  -- extend if same session
            ELSE packing_order_locks.expires_at 
        END,
        status = CASE 
            WHEN packing_order_locks.expires_at < v_now OR packing_order_locks.status != 'active'
            THEN 'active'
            ELSE packing_order_locks.status 
        END;
    
    -- เช็คว่าเราได้ lock หรือไม่
    SELECT * INTO v_existing 
    FROM packing_order_locks 
    WHERE tracking_number = p_tracking_number;
    
    IF v_existing.locked_by_session = p_session_id THEN
        RETURN QUERY SELECT 
            TRUE,
            p_session_id,
            v_existing.locked_at,
            'Lock acquired'::TEXT;
    ELSE
        RETURN QUERY SELECT 
            FALSE,
            v_existing.locked_by_session,
            v_existing.locked_at,
            format('ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น (%s)', COALESCE(v_existing.locked_by_device, 'ไม่ทราบ'))::TEXT;
    END IF;
END;
$$;

COMMENT ON FUNCTION lock_packing_order IS 
'Lock order สำหรับ packing - ใช้ advisory lock ป้องกัน race condition';

-- ============================================================================
-- Enable Realtime for packing_order_locks table
-- ============================================================================
DO $$
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'packing_order_locks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE packing_order_locks;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- Publication doesn't exist, skip
        NULL;
END $$;

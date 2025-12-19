-- ============================================================================
-- Migration: 156_add_rollback_columns_to_orders.sql
-- Description: เพิ่ม columns สำหรับ Rollback Lock และ Audit ใน wms_orders
-- Date: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: เพิ่ม Rollback Lock Columns
-- ============================================================================

-- 1.1 Lock timestamp
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_lock_at TIMESTAMPTZ;

-- 1.2 User ที่ lock
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_lock_by BIGINT;

-- 1.3 Lock expiration time
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_lock_expires_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 2: เพิ่ม Rollback Audit Columns
-- ============================================================================

-- 2.1 เหตุผลการ rollback
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_reason TEXT;

-- 2.2 เวลาที่ rollback
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_at TIMESTAMPTZ;

-- 2.3 User ที่ทำ rollback
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_by BIGINT;

-- 2.4 จำนวนครั้งที่ถูก rollback
ALTER TABLE wms_orders 
ADD COLUMN IF NOT EXISTS rollback_count INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 3: เพิ่ม Foreign Key Constraints
-- ============================================================================

-- 3.1 FK สำหรับ rollback_lock_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_rollback_lock_by' 
        AND table_name = 'wms_orders'
    ) THEN
        ALTER TABLE wms_orders 
        ADD CONSTRAINT fk_orders_rollback_lock_by 
        FOREIGN KEY (rollback_lock_by) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3.2 FK สำหรับ rollback_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_rollback_by' 
        AND table_name = 'wms_orders'
    ) THEN
        ALTER TABLE wms_orders 
        ADD CONSTRAINT fk_orders_rollback_by 
        FOREIGN KEY (rollback_by) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: สร้าง Index
-- ============================================================================

-- 4.1 Index สำหรับหา orders ที่ถูก lock
CREATE INDEX IF NOT EXISTS idx_orders_rollback_lock 
ON wms_orders(rollback_lock_at, rollback_lock_expires_at) 
WHERE rollback_lock_at IS NOT NULL;

-- 4.2 Index สำหรับหา orders ที่เคยถูก rollback
CREATE INDEX IF NOT EXISTS idx_orders_rollback_history 
ON wms_orders(rollback_at) 
WHERE rollback_at IS NOT NULL;


-- ============================================================================
-- STEP 5: สร้าง Functions สำหรับ Lock/Unlock Order
-- ============================================================================

-- 5.1 Function: Lock Order for Rollback
CREATE OR REPLACE FUNCTION lock_order_for_rollback(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_lock_duration_minutes INT DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
    v_locked BOOLEAN := FALSE;
    v_current_lock TIMESTAMPTZ;
    v_lock_expires TIMESTAMPTZ;
BEGIN
    -- ตรวจสอบว่า order มีอยู่จริง
    IF NOT EXISTS (SELECT 1 FROM wms_orders WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;
    
    -- ดึงข้อมูล lock ปัจจุบัน
    SELECT rollback_lock_at, rollback_lock_expires_at 
    INTO v_current_lock, v_lock_expires
    FROM wms_orders 
    WHERE order_id = p_order_id;
    
    -- ตรวจสอบว่ายังไม่ถูก lock หรือ lock หมดอายุแล้ว
    IF v_current_lock IS NULL OR v_lock_expires < NOW() THEN
        -- Lock order
        UPDATE wms_orders
        SET 
            rollback_lock_at = NOW(),
            rollback_lock_by = p_user_id,
            rollback_lock_expires_at = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL,
            updated_at = NOW()
        WHERE order_id = p_order_id;
        
        v_locked := TRUE;
        RAISE NOTICE 'Order % locked by user % for % minutes', p_order_id, p_user_id, p_lock_duration_minutes;
    ELSE
        RAISE NOTICE 'Order % is already locked until %', p_order_id, v_lock_expires;
    END IF;
    
    RETURN v_locked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Function: Unlock Order
CREATE OR REPLACE FUNCTION unlock_order_rollback(
    p_order_id BIGINT,
    p_user_id BIGINT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_lock_by BIGINT;
BEGIN
    -- ดึงข้อมูลว่าใครเป็นคน lock
    SELECT rollback_lock_by INTO v_lock_by
    FROM wms_orders 
    WHERE order_id = p_order_id;
    
    -- ถ้าระบุ user_id ต้องเป็นคนเดียวกับที่ lock หรือเป็น admin
    IF p_user_id IS NOT NULL AND v_lock_by IS NOT NULL AND v_lock_by != p_user_id THEN
        RAISE EXCEPTION 'Only the user who locked the order or admin can unlock it';
    END IF;
    
    UPDATE wms_orders
    SET 
        rollback_lock_at = NULL,
        rollback_lock_by = NULL,
        rollback_lock_expires_at = NULL,
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    RAISE NOTICE 'Order % unlocked', p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 Function: Check if Order is Locked
CREATE OR REPLACE FUNCTION is_order_locked_for_rollback(p_order_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_lock_at TIMESTAMPTZ;
    v_lock_expires TIMESTAMPTZ;
BEGIN
    SELECT rollback_lock_at, rollback_lock_expires_at 
    INTO v_lock_at, v_lock_expires
    FROM wms_orders 
    WHERE order_id = p_order_id;
    
    -- ถ้าไม่มี lock หรือ lock หมดอายุแล้ว
    IF v_lock_at IS NULL OR v_lock_expires < NOW() THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.4 Function: Get Lock Info
CREATE OR REPLACE FUNCTION get_order_lock_info(p_order_id BIGINT)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_by BIGINT,
    locked_by_name TEXT,
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    remaining_minutes INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN o.rollback_lock_at IS NOT NULL AND o.rollback_lock_expires_at > NOW() 
            THEN TRUE 
            ELSE FALSE 
        END AS is_locked,
        o.rollback_lock_by AS locked_by,
        u.full_name AS locked_by_name,
        o.rollback_lock_at AS locked_at,
        o.rollback_lock_expires_at AS expires_at,
        CASE 
            WHEN o.rollback_lock_expires_at > NOW() 
            THEN EXTRACT(EPOCH FROM (o.rollback_lock_expires_at - NOW()))::INT / 60
            ELSE 0
        END AS remaining_minutes
    FROM wms_orders o
    LEFT JOIN master_system_user u ON o.rollback_lock_by = u.user_id
    WHERE o.order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Add Comments
-- ============================================================================

COMMENT ON COLUMN wms_orders.rollback_lock_at IS 'เวลาที่ Order ถูก lock สำหรับ rollback';
COMMENT ON COLUMN wms_orders.rollback_lock_by IS 'User ID ที่ lock Order';
COMMENT ON COLUMN wms_orders.rollback_lock_expires_at IS 'เวลาที่ lock หมดอายุ';
COMMENT ON COLUMN wms_orders.rollback_reason IS 'เหตุผลที่ทำการ rollback';
COMMENT ON COLUMN wms_orders.rollback_at IS 'เวลาที่ทำการ rollback ล่าสุด';
COMMENT ON COLUMN wms_orders.rollback_by IS 'User ID ที่ทำการ rollback ล่าสุด';
COMMENT ON COLUMN wms_orders.rollback_count IS 'จำนวนครั้งที่ Order ถูก rollback';

COMMENT ON FUNCTION lock_order_for_rollback IS 'Lock Order เพื่อป้องกัน concurrent rollback';
COMMENT ON FUNCTION unlock_order_rollback IS 'Unlock Order หลังจาก rollback เสร็จ';
COMMENT ON FUNCTION is_order_locked_for_rollback IS 'ตรวจสอบว่า Order ถูก lock อยู่หรือไม่';
COMMENT ON FUNCTION get_order_lock_info IS 'ดึงข้อมูล lock ของ Order';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_columns_exist BOOLEAN;
    v_functions_exist BOOLEAN;
BEGIN
    -- Check columns
    SELECT COUNT(*) = 6 INTO v_columns_exist
    FROM information_schema.columns 
    WHERE table_name = 'wms_orders' 
    AND column_name IN (
        'rollback_lock_at', 'rollback_lock_by', 'rollback_lock_expires_at',
        'rollback_reason', 'rollback_at', 'rollback_by'
    );
    
    -- Check functions
    SELECT COUNT(*) = 4 INTO v_functions_exist
    FROM pg_proc 
    WHERE proname IN (
        'lock_order_for_rollback', 'unlock_order_rollback', 
        'is_order_locked_for_rollback', 'get_order_lock_info'
    );
    
    IF NOT v_columns_exist THEN
        RAISE WARNING 'Some rollback columns may not have been created';
    END IF;
    
    IF NOT v_functions_exist THEN
        RAISE WARNING 'Some rollback functions may not have been created';
    END IF;
    
    RAISE NOTICE '✅ Migration 156 completed: rollback columns and functions added to wms_orders';
END $$;

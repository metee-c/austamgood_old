-- ============================================================================
-- Migration: 225_create_distributed_locks_and_idempotency.sql
-- Description: สร้างระบบ Distributed Lock และ Idempotency สำหรับ concurrent operations
-- 
-- Features:
-- 1. Distributed Locks - ป้องกัน concurrent access ไปยัง resource เดียวกัน
-- 2. Idempotency - ป้องกัน process request ซ้ำ
-- 3. Order Locking - ป้องกันหลายคนทำงาน order เดียวกัน
-- ============================================================================

-- ============================================================================
-- PART 1: Distributed Locks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS distributed_locks (
    lock_key VARCHAR(255) PRIMARY KEY,
    locked_by VARCHAR(100) NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires 
ON distributed_locks(expires_at);

COMMENT ON TABLE distributed_locks IS 
'ตาราง Distributed Lock สำหรับป้องกัน concurrent access';

-- ============================================================================
-- PART 2: Idempotency Records Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(255) NOT NULL,
    api_endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64),
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    PRIMARY KEY (idempotency_key, api_endpoint)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
ON idempotency_records(expires_at);

COMMENT ON TABLE idempotency_records IS 
'ตาราง Idempotency สำหรับป้องกัน process request ซ้ำ';

-- ============================================================================
-- PART 3: Packing Order Locks Table (สำหรับ online-packing โดยเฉพาะ)
-- ============================================================================

CREATE TABLE IF NOT EXISTS packing_order_locks (
    tracking_number VARCHAR(100) PRIMARY KEY,
    locked_by_session VARCHAR(100) NOT NULL,
    locked_by_device VARCHAR(255),
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released'))
);

CREATE INDEX IF NOT EXISTS idx_packing_order_locks_expires 
ON packing_order_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_packing_order_locks_session 
ON packing_order_locks(locked_by_session);

COMMENT ON TABLE packing_order_locks IS 
'ตาราง Lock สำหรับ Online Packing - ป้องกันหลายเครื่องทำ order เดียวกัน';

-- ============================================================================
-- PART 4: Function - Acquire Distributed Lock
-- ============================================================================

CREATE OR REPLACE FUNCTION acquire_lock(
    p_lock_key VARCHAR,
    p_locked_by VARCHAR,
    p_timeout_seconds INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_expires_at TIMESTAMP WITH TIME ZONE := v_now + (p_timeout_seconds || ' seconds')::INTERVAL;
BEGIN
    -- ลบ lock ที่หมดอายุแล้ว
    DELETE FROM distributed_locks WHERE expires_at < v_now;
    
    -- พยายาม insert lock ใหม่
    INSERT INTO distributed_locks (lock_key, locked_by, locked_at, expires_at)
    VALUES (p_lock_key, p_locked_by, v_now, v_expires_at)
    ON CONFLICT (lock_key) DO NOTHING;
    
    -- เช็คว่า insert สำเร็จหรือไม่
    RETURN EXISTS(
        SELECT 1 FROM distributed_locks 
        WHERE lock_key = p_lock_key 
        AND locked_by = p_locked_by
    );
END;
$$;

COMMENT ON FUNCTION acquire_lock IS 
'ขอ lock สำหรับ resource - return TRUE ถ้าได้ lock';

-- ============================================================================
-- PART 5: Function - Release Distributed Lock
-- ============================================================================

CREATE OR REPLACE FUNCTION release_lock(
    p_lock_key VARCHAR,
    p_locked_by VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM distributed_locks 
    WHERE lock_key = p_lock_key 
    AND locked_by = p_locked_by;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;

COMMENT ON FUNCTION release_lock IS 
'ปล่อย lock - return TRUE ถ้าปล่อยสำเร็จ';

-- ============================================================================
-- PART 6: Function - Check Idempotency
-- ============================================================================

CREATE OR REPLACE FUNCTION check_idempotency(
    p_idempotency_key VARCHAR,
    p_api_endpoint VARCHAR
)
RETURNS TABLE(
    is_duplicate BOOLEAN,
    previous_response JSONB,
    previous_status INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- ลบ record ที่หมดอายุ
    DELETE FROM idempotency_records WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN QUERY
    SELECT 
        TRUE as is_duplicate,
        ir.response_body as previous_response,
        ir.response_status as previous_status
    FROM idempotency_records ir
    WHERE ir.idempotency_key = p_idempotency_key
    AND ir.api_endpoint = p_api_endpoint;
    
    -- ถ้าไม่เจอ return FALSE
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, NULL::INTEGER;
    END IF;
END;
$$;

COMMENT ON FUNCTION check_idempotency IS 
'ตรวจสอบว่า request ซ้ำหรือไม่';

-- ============================================================================
-- PART 7: Function - Save Idempotency Result
-- ============================================================================

CREATE OR REPLACE FUNCTION save_idempotency_result(
    p_idempotency_key VARCHAR,
    p_api_endpoint VARCHAR,
    p_request_hash VARCHAR,
    p_response_status INTEGER,
    p_response_body JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO idempotency_records (
        idempotency_key, 
        api_endpoint, 
        request_hash, 
        response_status, 
        response_body,
        expires_at
    )
    VALUES (
        p_idempotency_key, 
        p_api_endpoint, 
        p_request_hash, 
        p_response_status, 
        p_response_body,
        CURRENT_TIMESTAMP + INTERVAL '24 hours'
    )
    ON CONFLICT (idempotency_key, api_endpoint) DO UPDATE SET
        response_status = EXCLUDED.response_status,
        response_body = EXCLUDED.response_body;
END;
$$;

COMMENT ON FUNCTION save_idempotency_result IS 
'บันทึกผลลัพธ์ของ request สำหรับ idempotency';

-- ============================================================================
-- PART 8: Function - Lock Packing Order
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_packing_order(
    p_tracking_number VARCHAR,
    p_session_id VARCHAR,
    p_device_info VARCHAR DEFAULT NULL,
    p_timeout_seconds INTEGER DEFAULT 300  -- 5 minutes default
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
BEGIN
    -- ลบ lock ที่หมดอายุ
    DELETE FROM packing_order_locks WHERE expires_at < v_now;
    
    -- เช็คว่ามี lock อยู่แล้วหรือไม่
    SELECT * INTO v_existing 
    FROM packing_order_locks 
    WHERE tracking_number = p_tracking_number
    AND status = 'active';
    
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
                format('Order ถูก lock โดยเครื่องอื่น (%s)', v_existing.locked_by_device)::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- ไม่มี lock → สร้างใหม่
    INSERT INTO packing_order_locks (
        tracking_number, 
        locked_by_session, 
        locked_by_device, 
        locked_at, 
        expires_at
    )
    VALUES (
        p_tracking_number, 
        p_session_id, 
        p_device_info, 
        v_now, 
        v_expires_at
    );
    
    RETURN QUERY SELECT 
        TRUE,
        p_session_id,
        v_now,
        'Lock acquired'::TEXT;
END;
$$;

COMMENT ON FUNCTION lock_packing_order IS 
'Lock order สำหรับ packing - ป้องกันหลายเครื่องทำ order เดียวกัน';

-- ============================================================================
-- PART 9: Function - Release Packing Order Lock
-- ============================================================================

CREATE OR REPLACE FUNCTION release_packing_order_lock(
    p_tracking_number VARCHAR,
    p_session_id VARCHAR,
    p_mark_completed BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    IF p_mark_completed THEN
        UPDATE packing_order_locks 
        SET status = 'completed'
        WHERE tracking_number = p_tracking_number 
        AND locked_by_session = p_session_id;
    ELSE
        DELETE FROM packing_order_locks 
        WHERE tracking_number = p_tracking_number 
        AND locked_by_session = p_session_id;
    END IF;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;

COMMENT ON FUNCTION release_packing_order_lock IS 
'ปล่อย lock ของ packing order';

-- ============================================================================
-- PART 10: Function - Get Locked Orders (สำหรับ real-time sync)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_locked_packing_orders()
RETURNS TABLE(
    tracking_number VARCHAR,
    locked_by_session VARCHAR,
    locked_by_device VARCHAR,
    locked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- ลบ lock ที่หมดอายุก่อน
    DELETE FROM packing_order_locks WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN QUERY
    SELECT 
        pol.tracking_number,
        pol.locked_by_session,
        pol.locked_by_device,
        pol.locked_at,
        pol.expires_at
    FROM packing_order_locks pol
    WHERE pol.status = 'active';
END;
$$;

COMMENT ON FUNCTION get_locked_packing_orders IS 
'ดึงรายการ order ที่ถูก lock อยู่';

-- ============================================================================
-- PART 11: Function - Atomic Stock Move for Online Packing
-- ============================================================================

CREATE OR REPLACE FUNCTION atomic_online_pack_stock_move(
    p_order_number VARCHAR,
    p_tracking_number VARCHAR,
    p_platform VARCHAR,
    p_items JSONB,  -- [{sku_id, quantity}]
    p_user_id BIGINT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    items_moved INTEGER,
    negative_balance_items INTEGER,
    results JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_source_location VARCHAR := 'E-Commerce';
    v_dest_location VARCHAR := 'Dispatch';
    v_warehouse VARCHAR := 'WH001';
    v_items_moved INTEGER := 0;
    v_negative_count INTEGER := 0;
    v_results JSONB := '[]'::JSONB;
    v_qty_per_pack INTEGER;
    v_remaining_qty NUMERIC;
    v_actual_sku_id VARCHAR;
    v_dispatch_balance_id BIGINT;
BEGIN
    -- Loop through items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(sku_id VARCHAR, quantity NUMERIC)
    LOOP
        v_actual_sku_id := v_item.sku_id;
        
        -- Lookup SKU (try sku_id first, then barcode)
        SELECT sku_id, COALESCE(qty_per_pack, 1) INTO v_actual_sku_id, v_qty_per_pack
        FROM master_sku 
        WHERE sku_id = v_item.sku_id OR barcode = v_item.sku_id
        LIMIT 1;
        
        IF v_actual_sku_id IS NULL THEN
            v_actual_sku_id := v_item.sku_id;
            v_qty_per_pack := 1;
        END IF;
        
        v_remaining_qty := v_item.quantity;
        
        -- Deduct from E-Commerce balances (FEFO + FIFO) with FOR UPDATE lock
        FOR v_balance IN
            SELECT 
                balance_id, 
                pallet_id, 
                total_piece_qty,
                reserved_piece_qty,
                total_piece_qty - reserved_piece_qty as available_qty
            FROM wms_inventory_balances
            WHERE warehouse_id = v_warehouse
            AND location_id = v_source_location
            AND sku_id = v_actual_sku_id
            AND pallet_id NOT LIKE 'VIRTUAL-%'
            AND total_piece_qty > reserved_piece_qty
            ORDER BY expiry_date ASC NULLS LAST, production_date ASC NULLS LAST, created_at ASC
            FOR UPDATE SKIP LOCKED  -- ป้องกัน deadlock
        LOOP
            EXIT WHEN v_remaining_qty <= 0;
            
            DECLARE
                v_qty_to_move NUMERIC;
                v_pack_to_move NUMERIC;
            BEGIN
                v_qty_to_move := LEAST(v_balance.available_qty, v_remaining_qty);
                v_pack_to_move := v_qty_to_move / v_qty_per_pack;
                
                -- Deduct from source
                UPDATE wms_inventory_balances
                SET 
                    total_piece_qty = total_piece_qty - v_qty_to_move,
                    total_pack_qty = total_pack_qty - v_pack_to_move,
                    updated_at = v_now
                WHERE balance_id = v_balance.balance_id;
                
                v_remaining_qty := v_remaining_qty - v_qty_to_move;
            END;
        END LOOP;
        
        -- If not enough stock, create negative virtual balance
        IF v_remaining_qty > 0 THEN
            PERFORM create_or_update_virtual_balance(
                v_source_location,
                v_actual_sku_id,
                v_warehouse,
                -v_remaining_qty,
                -(v_remaining_qty / v_qty_per_pack),
                0, 0
            );
            v_negative_count := v_negative_count + 1;
        END IF;
        
        -- Add to Dispatch location (with lock)
        SELECT balance_id INTO v_dispatch_balance_id
        FROM wms_inventory_balances
        WHERE warehouse_id = v_warehouse
        AND location_id = v_dest_location
        AND sku_id = v_actual_sku_id
        FOR UPDATE;
        
        IF v_dispatch_balance_id IS NOT NULL THEN
            UPDATE wms_inventory_balances
            SET 
                total_piece_qty = total_piece_qty + v_item.quantity,
                total_pack_qty = total_pack_qty + (v_item.quantity / v_qty_per_pack),
                updated_at = v_now
            WHERE balance_id = v_dispatch_balance_id;
        ELSE
            INSERT INTO wms_inventory_balances (
                warehouse_id, location_id, sku_id, pallet_id,
                total_piece_qty, total_pack_qty,
                reserved_piece_qty, reserved_pack_qty,
                created_at, updated_at
            ) VALUES (
                v_warehouse, v_dest_location, v_actual_sku_id, 
                'DISPATCH-' || v_actual_sku_id,
                v_item.quantity, v_item.quantity / v_qty_per_pack,
                0, 0, v_now, v_now
            );
        END IF;
        
        -- Create ledger entries
        INSERT INTO wms_inventory_ledger (
            warehouse_id, location_id, sku_id,
            transaction_type, direction,
            piece_qty, pack_qty,
            reference_no, remarks,
            created_by, skip_balance_sync
        ) VALUES 
        (v_warehouse, v_dest_location, v_actual_sku_id, 'online_pack', 'in',
         v_item.quantity, v_item.quantity / v_qty_per_pack,
         p_order_number, format('แพ็คออนไลน์ - %s (%s)', p_order_number, p_tracking_number),
         p_user_id, TRUE),
        (v_warehouse, v_source_location, v_actual_sku_id, 'online_pack', 'out',
         v_item.quantity, v_item.quantity / v_qty_per_pack,
         p_order_number, format('แพ็คออนไลน์ - %s (%s)', p_order_number, p_tracking_number),
         p_user_id, TRUE);
        
        v_items_moved := v_items_moved + 1;
        v_results := v_results || jsonb_build_object(
            'sku_id', v_actual_sku_id,
            'quantity', v_item.quantity,
            'has_negative', v_remaining_qty > 0
        );
    END LOOP;
    
    RETURN QUERY SELECT 
        TRUE,
        format('Moved %s items from %s to %s', v_items_moved, v_source_location, v_dest_location)::TEXT,
        v_items_moved,
        v_negative_count,
        v_results;
END;
$$;

COMMENT ON FUNCTION atomic_online_pack_stock_move IS 
'Atomic stock move สำหรับ online packing - ใช้ row-level locking ป้องกัน race condition';

-- ============================================================================
-- PART 12: Cleanup Job - ลบ expired locks และ idempotency records
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_locks_and_idempotency()
RETURNS TABLE(
    locks_deleted INTEGER,
    idempotency_deleted INTEGER,
    packing_locks_deleted INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_locks INTEGER;
    v_idempotency INTEGER;
    v_packing INTEGER;
BEGIN
    DELETE FROM distributed_locks WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_locks = ROW_COUNT;
    
    DELETE FROM idempotency_records WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_idempotency = ROW_COUNT;
    
    DELETE FROM packing_order_locks WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_packing = ROW_COUNT;
    
    RETURN QUERY SELECT v_locks, v_idempotency, v_packing;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_locks_and_idempotency IS 
'ลบ expired locks และ idempotency records';

-- ============================================================================
-- Enable Realtime for packing_order_locks
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE packing_order_locks;

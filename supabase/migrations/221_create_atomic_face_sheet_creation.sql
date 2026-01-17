-- ============================================================================
-- Migration: 221_create_atomic_face_sheet_creation.sql
-- Description: สร้าง atomic function สำหรับ Face Sheet creation + stock reservation
-- 
-- BUG FIX: BUG-002 (P0) - Non-Atomic Multi-Step Transaction
-- 
-- ปัญหาเดิม:
-- - API เรียก create_face_sheet_packages() แล้ว commit
-- - จากนั้นเรียก reserve_stock_for_face_sheet_items() แยก
-- - ถ้า step 2 fail → Face sheet สร้างแล้วแต่ไม่มี reservation (orphaned)
-- 
-- แก้ไข:
-- - รวม 2 steps ให้อยู่ใน transaction เดียว
-- - ถ้า ANY step fail → ROLLBACK ทั้งหมด (nothing created)
-- - ใช้ Advisory Lock ป้องกัน duplicate face sheet number
-- ============================================================================

-- ============================================================================
-- PART 1: Helper Function - Generate Face Sheet Number with Advisory Lock
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_face_sheet_no_with_lock()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_face_sheet_no VARCHAR;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Try to acquire advisory lock (key = 1001 for face sheets)
    -- This prevents concurrent transactions from generating duplicate numbers
    v_lock_acquired := pg_try_advisory_xact_lock(1001);
    
    IF NOT v_lock_acquired THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างเลขที่ใบปะหน้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    END IF;
    
    -- Generate face sheet number (existing logic)
    SELECT 'FS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 16) AS INTEGER)), 0) + 1, 3, '0')
    INTO v_face_sheet_no
    FROM face_sheets
    WHERE face_sheet_no LIKE 'FS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    RETURN v_face_sheet_no;
END;
$$;

COMMENT ON FUNCTION generate_face_sheet_no_with_lock IS 
'สร้างเลขที่ใบปะหน้าพร้อม Advisory Lock เพื่อป้องกัน duplicate';

-- ============================================================================
-- PART 2: Atomic Function - Create Face Sheet with Stock Reservation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_face_sheet_with_reservation(
    p_delivery_date DATE,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_order_ids INTEGER[] DEFAULT NULL,
    p_created_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
    success BOOLEAN,
    face_sheet_id BIGINT,
    face_sheet_no VARCHAR,
    total_packages INTEGER,
    small_size_count INTEGER,
    large_size_count INTEGER,
    items_reserved INTEGER,
    message TEXT,
    error_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_face_sheet_no VARCHAR;
    v_face_sheet_id BIGINT;
    v_total_packages INTEGER := 0;
    v_small_size_count INTEGER := 0;
    v_large_size_count INTEGER := 0;
    v_items_reserved INTEGER := 0;
    v_reserve_result RECORD;
    v_order_count INTEGER;
BEGIN
    -- ========================================
    -- STEP 1: Validate Input
    -- ========================================
    
    IF p_delivery_date IS NULL THEN
        RAISE EXCEPTION 'กรุณาระบุวันส่งของ';
    END IF;
    
    -- Check if orders exist
    IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
        SELECT COUNT(*) INTO v_order_count
        FROM wms_orders
        WHERE order_id = ANY(p_order_ids)
        AND order_type = 'express'
        AND delivery_date = p_delivery_date;
        
        IF v_order_count = 0 THEN
            RAISE EXCEPTION 'ไม่พบออเดอร์ที่เลือก';
        END IF;
    ELSE
        -- Check if there are any orders for the date
        SELECT COUNT(*) INTO v_order_count
        FROM wms_orders
        WHERE order_type = 'express'
        AND delivery_date = p_delivery_date
        AND status IN ('draft', 'confirmed');
        
        IF v_order_count = 0 THEN
            RAISE EXCEPTION 'ไม่พบออเดอร์สำหรับวันที่เลือก';
        END IF;
    END IF;
    
    -- ========================================
    -- STEP 2: Generate Face Sheet Number (with Advisory Lock)
    -- ========================================
    
    v_face_sheet_no := generate_face_sheet_no_with_lock();
    
    -- ========================================
    -- STEP 3: Create Face Sheet Header
    -- ========================================
    
    INSERT INTO face_sheets (
        face_sheet_no,
        warehouse_id,
        delivery_date,
        status,
        created_by,
        created_at
    ) VALUES (
        v_face_sheet_no,
        p_warehouse_id,
        p_delivery_date,
        'generated',
        p_created_by,
        CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_face_sheet_id;
    
    IF v_face_sheet_id IS NULL THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างใบปะหน้าได้';
    END IF;
    
    -- ========================================
    -- STEP 4: Create Face Sheet Items from Orders
    -- ========================================
    
    -- Insert face sheet items (logic from create_face_sheet_packages)
    INSERT INTO face_sheet_items (
        face_sheet_id,
        order_id,
        order_item_id,
        sku_id,
        quantity,
        uom,
        package_size,
        hub,
        customer_id,
        status,
        created_at
    )
    SELECT 
        v_face_sheet_id,
        o.order_id,
        oi.order_item_id,
        oi.sku_id,
        oi.quantity,
        oi.uom,
        CASE 
            WHEN ms.weight_kg > 7 THEN 'large'
            ELSE 'small'
        END as package_size,
        mc.hub,
        o.customer_id,
        'pending',
        CURRENT_TIMESTAMP
    FROM wms_orders o
    JOIN wms_order_items oi ON oi.order_id = o.order_id
    JOIN master_sku ms ON ms.sku_id = oi.sku_id
    LEFT JOIN master_customer mc ON mc.customer_id = o.customer_id
    WHERE o.order_type = 'express'
    AND o.delivery_date = p_delivery_date
    AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids))
    AND o.status IN ('draft', 'confirmed');
    
    -- Count packages
    SELECT 
        COUNT(*),
        SUM(CASE WHEN package_size = 'small' THEN 1 ELSE 0 END),
        SUM(CASE WHEN package_size = 'large' THEN 1 ELSE 0 END)
    INTO v_total_packages, v_small_size_count, v_large_size_count
    FROM face_sheet_items
    WHERE face_sheet_id = v_face_sheet_id;
    
    -- Update face sheet header with counts
    UPDATE face_sheets
    SET 
        total_packages = v_total_packages,
        small_size_count = v_small_size_count,
        large_size_count = v_large_size_count
    WHERE id = v_face_sheet_id;
    
    IF v_total_packages = 0 THEN
        RAISE EXCEPTION 'ไม่มีรายการสินค้าในใบปะหน้า';
    END IF;
    
    -- ========================================
    -- STEP 5: Reserve Stock (CRITICAL - Must Succeed)
    -- ========================================
    
    -- Call existing reserve function (now with FOR UPDATE from Migration 220)
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_face_sheet_items(
        p_face_sheet_id := v_face_sheet_id,
        p_warehouse_id := p_warehouse_id,
        p_reserved_by := p_created_by
    );
    
    -- Check if reservation succeeded
    IF NOT v_reserve_result.success THEN
        -- RAISE EXCEPTION will trigger automatic ROLLBACK
        RAISE EXCEPTION 'การจองสต็อคไม่สำเร็จ: % (รายละเอียด: %)', 
            v_reserve_result.message,
            v_reserve_result.insufficient_stock_items::TEXT;
    END IF;
    
    v_items_reserved := v_reserve_result.items_reserved;
    
    -- ========================================
    -- STEP 6: Update Order Status to 'confirmed'
    -- ========================================
    
    UPDATE wms_orders
    SET 
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE order_type = 'express'
    AND delivery_date = p_delivery_date
    AND (p_order_ids IS NULL OR order_id = ANY(p_order_ids))
    AND status = 'draft';
    
    -- ========================================
    -- STEP 7: Return Success
    -- ========================================
    
    RETURN QUERY SELECT 
        TRUE,
        v_face_sheet_id,
        v_face_sheet_no,
        v_total_packages,
        v_small_size_count,
        v_large_size_count,
        v_items_reserved,
        format('สร้างใบปะหน้า %s สำเร็จ (%s รายการ, จองสต็อค %s รายการ)', 
               v_face_sheet_no, v_total_packages, v_items_reserved)::TEXT,
        NULL::JSONB;
        
EXCEPTION
    WHEN OTHERS THEN
        -- Any exception will trigger automatic ROLLBACK
        -- Return error details
        RETURN QUERY SELECT 
            FALSE,
            NULL::BIGINT,
            NULL::VARCHAR,
            0,
            0,
            0,
            0,
            SQLERRM::TEXT,
            jsonb_build_object(
                'error_code', SQLSTATE,
                'error_message', SQLERRM,
                'error_detail', COALESCE(PG_EXCEPTION_DETAIL, ''),
                'error_hint', COALESCE(PG_EXCEPTION_HINT, '')
            );
END;
$$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS 
'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic - ถ้า ANY step fail จะ ROLLBACK ทั้งหมด (BUG-002 Fix)';

-- ============================================================================
-- PART 3: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION generate_face_sheet_no_with_lock TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ============================================================================
-- PART 4: Testing Query (Comment out in production)
-- ============================================================================

-- Test the function:
-- SELECT * FROM create_face_sheet_with_reservation(
--     p_warehouse_id := 'WH001',
--     p_delivery_date := '2026-01-20',
--     p_order_ids := NULL,  -- or ARRAY[1, 2, 3]
--     p_created_by := 'test-user'
-- );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

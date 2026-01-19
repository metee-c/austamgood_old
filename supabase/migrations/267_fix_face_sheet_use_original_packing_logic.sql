-- ============================================================================
-- Migration: 267_fix_face_sheet_use_original_packing_logic.sql
-- Description: แก้ไข create_face_sheet_with_reservation ให้ใช้ logic จาก create_face_sheet_packages
--
-- ปัญหา: Function ใหม่ใช้ CEIL(order_qty / qty_per_pack) ซึ่งผิด
-- Logic ที่ถูกต้อง:
-- 1. สินค้า 7kg และ 10kg - จับคู่ 2 ชิ้นต่อ 1 package (เศษ = แพ็ค 1 ชิ้น)
-- 2. สินค้าขนาดอื่น - ใช้ packing columns (pack_12_bags, pack_6, pack_4, pack_2, pack_1)
--
-- วิธีแก้: เรียก create_face_sheet_packages() ก่อน แล้วเรียก reserve_stock_for_face_sheet_items()
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
    v_face_sheet_id BIGINT;
    v_face_sheet_no VARCHAR;
    v_total_packages INTEGER := 0;
    v_small_size_count INTEGER := 0;
    v_large_size_count INTEGER := 0;
    v_items_reserved INTEGER := 0;
    v_reserve_result RECORD;
    v_package_result RECORD;
BEGIN
    -- ========================================
    -- STEP 1: Validate Input
    -- ========================================

    IF p_delivery_date IS NULL THEN
        RAISE EXCEPTION 'กรุณาระบุวันส่งของ';
    END IF;

    -- ========================================
    -- STEP 2: Create Face Sheet using original packing logic
    -- ✅ FIX: Use create_face_sheet_packages() which has correct 7kg/10kg pairing logic
    -- ========================================

    -- Convert INTEGER[] to BIGINT[] for the function
    SELECT * INTO v_package_result
    FROM create_face_sheet_packages(
        p_face_sheet_no := NULL,  -- Auto-generate
        p_warehouse_id := p_warehouse_id,
        p_created_by := p_created_by,
        p_delivery_date := p_delivery_date,
        p_order_ids := CASE
            WHEN p_order_ids IS NULL THEN NULL
            ELSE p_order_ids::BIGINT[]
        END
    );

    -- Check if package creation succeeded
    IF NOT v_package_result.success THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::VARCHAR,
            0,
            0,
            0,
            0,
            v_package_result.message::TEXT,
            jsonb_build_object(
                'error_code', 'PACKAGE_CREATION_FAILED',
                'error_message', v_package_result.message
            );
        RETURN;
    END IF;

    v_face_sheet_id := v_package_result.face_sheet_id;
    v_face_sheet_no := v_package_result.face_sheet_no;
    v_total_packages := v_package_result.total_packages;
    v_small_size_count := v_package_result.small_size_count;
    v_large_size_count := v_package_result.large_size_count;

    -- ========================================
    -- STEP 3: Reserve Stock (CRITICAL - Must Succeed)
    -- ========================================

    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_face_sheet_items(
        p_face_sheet_id := v_face_sheet_id,
        p_warehouse_id := p_warehouse_id,
        p_reserved_by := p_created_by
    );

    -- Check if reservation succeeded
    IF NOT v_reserve_result.success THEN
        -- Rollback: Delete the face sheet if stock reservation fails
        DELETE FROM face_sheet_items WHERE face_sheet_id = v_face_sheet_id;
        DELETE FROM face_sheet_packages WHERE face_sheet_id = v_face_sheet_id;
        DELETE FROM face_sheets WHERE id = v_face_sheet_id;

        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::VARCHAR,
            0,
            0,
            0,
            0,
            ('การจองสต็อคไม่สำเร็จ: ' || v_reserve_result.message)::TEXT,
            jsonb_build_object(
                'error_code', 'STOCK_RESERVATION_FAILED',
                'error_message', v_reserve_result.message,
                'insufficient_stock_items', v_reserve_result.insufficient_stock_items
            );
        RETURN;
    END IF;

    v_items_reserved := v_reserve_result.items_reserved;

    -- ========================================
    -- STEP 4: Update Order Status to 'confirmed'
    -- ========================================

    UPDATE wms_orders
    SET
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE order_type = 'express'
    AND delivery_date = p_delivery_date
    AND (p_order_ids IS NULL OR order_id = ANY(p_order_ids::BIGINT[]))
    AND status = 'draft';

    -- ========================================
    -- STEP 5: Return Success
    -- ========================================

    RETURN QUERY SELECT
        TRUE,
        v_face_sheet_id,
        v_face_sheet_no,
        v_total_packages,
        v_small_size_count,
        v_large_size_count,
        v_items_reserved,
        format('สร้างใบปะหน้า %s สำเร็จ (%s แพ็ค, จองสต็อค %s รายการ)',
               v_face_sheet_no, v_total_packages, v_items_reserved)::TEXT,
        NULL::JSONB;

EXCEPTION
    WHEN OTHERS THEN
        -- Cleanup on error
        IF v_face_sheet_id IS NOT NULL THEN
            DELETE FROM face_sheet_item_reservations WHERE face_sheet_id = v_face_sheet_id;
            DELETE FROM face_sheet_items WHERE face_sheet_id = v_face_sheet_id;
            DELETE FROM face_sheet_packages WHERE face_sheet_id = v_face_sheet_id;
            DELETE FROM face_sheets WHERE id = v_face_sheet_id;
        END IF;

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
                'error_message', SQLERRM
            );
END;
$$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS
'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic - ใช้ logic การจัดแพ็คจาก create_face_sheet_packages (7kg/10kg pairing)';

GRANT EXECUTE ON FUNCTION create_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

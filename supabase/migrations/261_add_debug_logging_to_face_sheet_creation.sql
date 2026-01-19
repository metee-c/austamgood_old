-- ============================================================================
-- Migration: 261_add_debug_logging_to_face_sheet_creation.sql
-- Description: เพิ่ม debug logging ใน create_face_sheet_with_reservation
--              เพื่อดูว่าเกิดอะไรขึ้นตอนสร้าง face sheet
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
AS $
DECLARE
    v_face_sheet_no VARCHAR;
    v_face_sheet_id BIGINT;
    v_total_packages INTEGER := 0;
    v_small_size_count INTEGER := 0;
    v_large_size_count INTEGER := 0;
    v_items_reserved INTEGER := 0;
    v_reserve_result RECORD;
    v_order_count INTEGER;
    v_debug_info JSONB := '[]'::JSONB;
BEGIN
    -- ========================================
    -- STEP 1: Validate Input
    -- ========================================
    
    RAISE NOTICE '🔍 [DEBUG] Starting face sheet creation';
    RAISE NOTICE '🔍 [DEBUG] p_delivery_date: %, p_warehouse_id: %, p_order_ids: %, p_created_by: %', 
        p_delivery_date, p_warehouse_id, p_order_ids, p_created_by;
    
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
        
        RAISE NOTICE '🔍 [DEBUG] Found % orders matching criteria', v_order_count;
        
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
        
        RAISE NOTICE '🔍 [DEBUG] Found % orders for date %', v_order_count, p_delivery_date;
        
        IF v_order_count = 0 THEN
            RAISE EXCEPTION 'ไม่พบออเดอร์สำหรับวันที่เลือก';
        END IF;
    END IF;
    
    -- ========================================
    -- STEP 2: Generate Face Sheet Number (with Advisory Lock)
    -- ========================================
    
    RAISE NOTICE '🔍 [DEBUG] Generating face sheet number...';
    v_face_sheet_no := generate_face_sheet_no_with_lock();
    RAISE NOTICE '🔍 [DEBUG] Generated face sheet number: %', v_face_sheet_no;
    
    -- ========================================
    -- STEP 3: Create Face Sheet Header
    -- ========================================
    
    RAISE NOTICE '🔍 [DEBUG] Creating face sheet header...';
    INSERT INTO face_sheets (
        face_sheet_no,
        warehouse_id,
        created_date,
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
    
    RAISE NOTICE '🔍 [DEBUG] Created face sheet with ID: %', v_face_sheet_id;
    
    IF v_face_sheet_id IS NULL THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างใบปะหน้าได้';
    END IF;
    
    -- ========================================
    -- STEP 4: Create Face Sheet Packages and Items from Orders
    -- ========================================
    
    RAISE NOTICE '🔍 [DEBUG] Creating face sheet packages and items...';
    
    -- First, create packages in face_sheet_packages table
    WITH package_data AS (
        SELECT 
            v_face_sheet_id as face_sheet_id,
            ROW_NUMBER() OVER (ORDER BY o.order_id, oi.order_item_id) as package_number,
            'FS-PKG-' || v_face_sheet_id || '-' || ROW_NUMBER() OVER (ORDER BY o.order_id, oi.order_item_id) as barcode_id,
            o.order_no,
            o.order_id,
            o.customer_id,
            mc.customer_name as shop_name,
            oi.sku_id as product_code,
            ms.sku_name as product_name,
            CASE 
                WHEN COALESCE(ms.weight_per_pack_kg, 0) > 7 THEN 'large'
                ELSE 'small'
            END as size_category,
            COALESCE(ms.weight_per_pack_kg, 0) as package_weight,
            mc.shipping_address as address,
            mc.province,
            mc.contact_person as contact_name,
            mc.phone,
            mc.hub,
            o.order_id as ref_order_id,
            oi.order_item_id as ref_order_item_id,
            oi.order_qty as ref_quantity
        FROM wms_orders o
        JOIN wms_order_items oi ON oi.order_id = o.order_id
        JOIN master_sku ms ON ms.sku_id = oi.sku_id
        LEFT JOIN master_customer mc ON mc.customer_id = o.customer_id
        WHERE o.order_type = 'express'
        AND o.delivery_date = p_delivery_date
        AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids))
        AND o.status IN ('draft', 'confirmed')
    ),
    inserted_packages AS (
        INSERT INTO face_sheet_packages (
            face_sheet_id,
            package_number,
            barcode_id,
            order_no,
            order_id,
            customer_id,
            shop_name,
            product_code,
            product_name,
            size_category,
            package_weight,
            address,
            province,
            contact_name,
            phone,
            hub
        )
        SELECT 
            face_sheet_id,
            package_number,
            barcode_id,
            order_no,
            order_id,
            customer_id,
            shop_name,
            product_code,
            product_name,
            size_category,
            package_weight,
            address,
            province,
            contact_name,
            phone,
            hub
        FROM package_data
        RETURNING id, barcode_id
    )
    -- Now insert face_sheet_items referencing the created packages
    INSERT INTO face_sheet_items (
        face_sheet_id,
        package_id,
        order_id,
        order_item_id,
        sku_id,
        quantity,
        size,
        status,
        created_at
    )
    SELECT 
        pd.face_sheet_id,
        ip.id,
        pd.ref_order_id,
        pd.ref_order_item_id,
        pd.product_code,
        pd.ref_quantity,
        pd.size_category,
        'pending',
        CURRENT_TIMESTAMP
    FROM package_data pd
    JOIN inserted_packages ip ON ip.barcode_id = pd.barcode_id;
    
    -- Count packages
    SELECT 
        COUNT(*),
        SUM(CASE WHEN size = 'small' THEN 1 ELSE 0 END),
        SUM(CASE WHEN size = 'large' THEN 1 ELSE 0 END)
    INTO v_total_packages, v_small_size_count, v_large_size_count
    FROM face_sheet_items
    WHERE face_sheet_id = v_face_sheet_id;
    
    RAISE NOTICE '🔍 [DEBUG] Created % packages (% small, % large)', 
        v_total_packages, v_small_size_count, v_large_size_count;
    
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
    
    RAISE NOTICE '🔍 [DEBUG] Calling reserve_stock_for_face_sheet_items...';
    RAISE NOTICE '🔍 [DEBUG] Parameters: face_sheet_id=%, warehouse_id=%, reserved_by=%', 
        v_face_sheet_id, p_warehouse_id, p_created_by;
    
    -- Call existing reserve function
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_face_sheet_items(
        p_face_sheet_id := v_face_sheet_id,
        p_warehouse_id := p_warehouse_id,
        p_reserved_by := p_created_by
    );
    
    RAISE NOTICE '🔍 [DEBUG] Reservation result: success=%, items_reserved=%, message=%', 
        v_reserve_result.success, v_reserve_result.items_reserved, v_reserve_result.message;
    
    -- Check if reservation succeeded
    IF NOT v_reserve_result.success THEN
        RAISE NOTICE '❌ [DEBUG] Reservation failed!';
        RAISE NOTICE '❌ [DEBUG] Insufficient stock items: %', v_reserve_result.insufficient_stock_items::TEXT;
        -- RAISE EXCEPTION will trigger automatic ROLLBACK
        RAISE EXCEPTION 'การจองสต็อคไม่สำเร็จ: % (รายละเอียด: %)', 
            v_reserve_result.message,
            v_reserve_result.insufficient_stock_items::TEXT;
    END IF;
    
    v_items_reserved := v_reserve_result.items_reserved;
    RAISE NOTICE '✅ [DEBUG] Successfully reserved % items', v_items_reserved;
    
    -- ========================================
    -- STEP 6: Update Order Status to 'confirmed'
    -- ========================================
    
    RAISE NOTICE '🔍 [DEBUG] Updating order status to confirmed...';
    UPDATE wms_orders
    SET 
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE order_type = 'express'
    AND delivery_date = p_delivery_date
    AND (p_order_ids IS NULL OR order_id = ANY(p_order_ids))
    AND status = 'draft';
    
    RAISE NOTICE '✅ [DEBUG] Face sheet creation completed successfully!';
    
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
        -- Return error details with debug info
        RAISE NOTICE '❌ [DEBUG] Exception caught: %', SQLERRM;
        RAISE NOTICE '❌ [DEBUG] SQLSTATE: %', SQLSTATE;
        RAISE NOTICE '❌ [DEBUG] Error detail: %', COALESCE(PG_EXCEPTION_DETAIL, 'N/A');
        RAISE NOTICE '❌ [DEBUG] Error hint: %', COALESCE(PG_EXCEPTION_HINT, 'N/A');
        RAISE NOTICE '❌ [DEBUG] Error context: %', COALESCE(PG_EXCEPTION_CONTEXT, 'N/A');
        
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
                'error_hint', COALESCE(PG_EXCEPTION_HINT, ''),
                'error_context', COALESCE(PG_EXCEPTION_CONTEXT, '')
            );
END;
$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS 
'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic พร้อม debug logging';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_face_sheet_with_reservation TO anon, authenticated, service_role;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 261 completed: Added debug logging to create_face_sheet_with_reservation';
END $$;

-- ============================================================================
-- Migration: 223_fix_pg_exception_detail.sql
-- Description: แก้ไข PG_EXCEPTION_DETAIL ที่ไม่มีใน PostgreSQL
-- 
-- ปัญหา: Migration 221 และ 222 ใช้ PG_EXCEPTION_DETAIL ซึ่งไม่มีใน PostgreSQL
-- แก้ไข: เปลี่ยนเป็น PG_EXCEPTION_CONTEXT หรือลบออก
-- ============================================================================

-- Fix Migration 221: create_face_sheet_with_reservation
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
        oi.order_qty,
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
    
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_face_sheet_items(
        p_face_sheet_id := v_face_sheet_id,
        p_warehouse_id := p_warehouse_id,
        p_reserved_by := p_created_by
    );
    
    IF NOT v_reserve_result.success THEN
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
        -- Return error details (FIXED: removed PG_EXCEPTION_DETAIL)
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
                'error_hint', COALESCE(PG_EXCEPTION_HINT, '')
            );
END;
$$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS 
'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic - ถ้า ANY step fail จะ ROLLBACK ทั้งหมด (BUG-002 Fix, Migration 223: Fixed PG_EXCEPTION_DETAIL)';

-- ============================================================================
-- Fix Migration 222: create_bonus_face_sheet_with_reservation
-- ============================================================================

-- Note: Only fixing the EXCEPTION block, keeping the rest of the function intact
-- The full function is in migration 222, we're just patching the error handling

DO $$
BEGIN
    -- Check if function exists before attempting to replace
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_bonus_face_sheet_with_reservation'
    ) THEN
        -- Replace the function with fixed exception handling
        EXECUTE '
        CREATE OR REPLACE FUNCTION create_bonus_face_sheet_with_reservation(
            p_loadlist_id INTEGER,
            p_packages JSONB,
            p_created_by VARCHAR DEFAULT ''System''
        )
        RETURNS TABLE(
            success BOOLEAN,
            face_sheet_id BIGINT,
            face_sheet_code VARCHAR,
            total_packages INTEGER,
            items_reserved INTEGER,
            message TEXT,
            error_details JSONB
        )
        LANGUAGE plpgsql
        AS $func$
        DECLARE
            v_face_sheet_code VARCHAR;
            v_face_sheet_id BIGINT;
            v_total_packages INTEGER := 0;
            v_items_reserved INTEGER := 0;
            v_package JSONB;
            v_package_id BIGINT;
            v_package_number INTEGER := 0;
            v_barcode_id VARCHAR;
            v_reserve_result RECORD;
        BEGIN
            -- Validate input
            IF p_loadlist_id IS NULL THEN
                RAISE EXCEPTION ''กรุณาระบุ Loadlist ID'';
            END IF;
            
            IF p_packages IS NULL OR jsonb_array_length(p_packages) = 0 THEN
                RAISE EXCEPTION ''กรุณาระบุรายการแพ็คเกจ'';
            END IF;
            
            -- Generate face sheet code with advisory lock
            SELECT pg_try_advisory_xact_lock(1002) INTO v_face_sheet_code;
            
            SELECT ''BFS-'' || TO_CHAR(CURRENT_DATE, ''YYYYMMDD'') || ''-'' || 
                   LPAD(COALESCE(MAX(CAST(SUBSTRING(face_sheet_code FROM 17) AS INTEGER)), 0) + 1, 3, ''0'')
            INTO v_face_sheet_code
            FROM bonus_face_sheets
            WHERE face_sheet_code LIKE ''BFS-'' || TO_CHAR(CURRENT_DATE, ''YYYYMMDD'') || ''-%'';
            
            -- Create face sheet header
            INSERT INTO bonus_face_sheets (
                face_sheet_code,
                loadlist_id,
                status,
                created_by,
                created_at
            ) VALUES (
                v_face_sheet_code,
                p_loadlist_id,
                ''generated'',
                p_created_by,
                CURRENT_TIMESTAMP
            )
            RETURNING id INTO v_face_sheet_id;
            
            -- Insert packages and items
            FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
            LOOP
                v_package_number := v_package_number + 1;
                v_barcode_id := v_face_sheet_code || ''-'' || LPAD(v_package_number::TEXT, 3, ''0'');
                
                INSERT INTO bonus_face_sheet_packages (
                    face_sheet_id,
                    package_number,
                    barcode_id,
                    order_id,
                    order_no,
                    customer_code,
                    shop_name,
                    address,
                    province,
                    contact_info,
                    phone,
                    hub,
                    delivery_type,
                    remark,
                    sales_territory,
                    trip_number,
                    pack_no,
                    total_items,
                    created_at
                ) VALUES (
                    v_face_sheet_id,
                    v_package_number,
                    v_barcode_id,
                    (v_package->>''order_id'')::INTEGER,
                    v_package->>''order_no'',
                    v_package->>''customer_code'',
                    v_package->>''shop_name'',
                    v_package->>''address'',
                    v_package->>''province'',
                    v_package->>''contact_info'',
                    v_package->>''phone'',
                    v_package->>''hub'',
                    v_package->>''delivery_type'',
                    COALESCE(v_package->>''remark'', ''''),
                    COALESCE(v_package->>''sales_territory'', ''''),
                    COALESCE(v_package->>''trip_number'', ''''),
                    COALESCE(v_package->>''pack_no'', ''''),
                    jsonb_array_length(COALESCE(v_package->''items'', ''[]''::JSONB)),
                    CURRENT_TIMESTAMP
                )
                RETURNING id INTO v_package_id;
                
                -- Insert items
                IF v_package->''items'' IS NOT NULL AND jsonb_array_length(v_package->''items'') > 0 THEN
                    INSERT INTO bonus_face_sheet_items (
                        face_sheet_id,
                        package_id,
                        order_item_id,
                        sku_id,
                        product_code,
                        product_name,
                        quantity,
                        quantity_to_pick,
                        unit,
                        uom,
                        weight,
                        status,
                        created_at
                    )
                    SELECT 
                        v_face_sheet_id,
                        v_package_id,
                        (item->>''order_item_id'')::INTEGER,
                        item->>''product_code'',
                        item->>''product_code'',
                        item->>''product_name'',
                        (item->>''quantity'')::NUMERIC,
                        (item->>''quantity'')::NUMERIC,
                        item->>''unit'',
                        item->>''uom'',
                        COALESCE((item->>''weight'')::NUMERIC, 0),
                        ''pending'',
                        CURRENT_TIMESTAMP
                    FROM jsonb_array_elements(v_package->''items'') AS item;
                END IF;
            END LOOP;
            
            v_total_packages := v_package_number;
            
            -- Update face sheet header
            UPDATE bonus_face_sheets
            SET total_packages = v_total_packages
            WHERE id = v_face_sheet_id;
            
            -- Reserve stock
            SELECT * INTO v_reserve_result
            FROM reserve_stock_for_bonus_face_sheet_items(
                p_face_sheet_id := v_face_sheet_id,
                p_reserved_by := p_created_by
            );
            
            IF NOT v_reserve_result.success THEN
                RAISE EXCEPTION ''การจองสต็อคไม่สำเร็จ: %'', v_reserve_result.message;
            END IF;
            
            v_items_reserved := v_reserve_result.items_reserved;
            
            -- Return success
            RETURN QUERY SELECT 
                TRUE,
                v_face_sheet_id,
                v_face_sheet_code,
                v_total_packages,
                v_items_reserved,
                format(''สร้าง Bonus Face Sheet %s สำเร็จ (%s แพ็คเกจ, จองสต็อค %s รายการ)'', 
                       v_face_sheet_code, v_total_packages, v_items_reserved)::TEXT,
                NULL::JSONB;
                
        EXCEPTION
            WHEN OTHERS THEN
                -- FIXED: Removed PG_EXCEPTION_DETAIL
                RETURN QUERY SELECT 
                    FALSE,
                    NULL::BIGINT,
                    NULL::VARCHAR,
                    0,
                    0,
                    SQLERRM::TEXT,
                    jsonb_build_object(
                        ''error_code'', SQLSTATE,
                        ''error_message'', SQLERRM,
                        ''error_hint'', COALESCE(PG_EXCEPTION_HINT, '''')
                    );
        END;
        $func$;
        ';
        
        RAISE NOTICE 'Fixed create_bonus_face_sheet_with_reservation function';
    END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

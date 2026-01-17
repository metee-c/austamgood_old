-- ============================================================================
-- Migration: 222_create_atomic_bonus_face_sheet_creation.sql
-- Description: สร้าง atomic function สำหรับ Bonus Face Sheet creation + stock reservation
-- 
-- BUG FIX: BUG-002 (P0) - Non-Atomic Multi-Step Transaction
-- 
-- ปัญหาเดิม:
-- - API สร้าง bonus_face_sheets header แล้ว commit
-- - จากนั้นสร้าง packages และ items
-- - จากนั้นเรียก reserve_stock_for_bonus_face_sheet_items() แยก
-- - ถ้า step สุดท้าย fail → Bonus face sheet สร้างแล้วแต่ไม่มี reservation
-- 
-- แก้ไข:
-- - รวมทุก steps ให้อยู่ใน transaction เดียว
-- - ถ้า ANY step fail → ROLLBACK ทั้งหมด (nothing created)
-- - ใช้ Advisory Lock ป้องกัน duplicate face sheet number
-- ============================================================================

-- ============================================================================
-- PART 1: Helper Function - Generate Bonus Face Sheet Number with Advisory Lock
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_bonus_face_sheet_no_with_lock()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_face_sheet_no VARCHAR;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Try to acquire advisory lock (key = 1002 for bonus face sheets)
    -- This prevents concurrent transactions from generating duplicate numbers
    v_lock_acquired := pg_try_advisory_xact_lock(1002);
    
    IF NOT v_lock_acquired THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างเลขที่ใบปะหน้าของแถมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    END IF;
    
    -- Generate bonus face sheet number (existing logic)
    SELECT 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 17) AS INTEGER)), 0) + 1, 3, '0')
    INTO v_face_sheet_no
    FROM bonus_face_sheets
    WHERE face_sheet_no LIKE 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    RETURN v_face_sheet_no;
END;
$$;

COMMENT ON FUNCTION generate_bonus_face_sheet_no_with_lock IS 
'สร้างเลขที่ใบปะหน้าของแถมพร้อม Advisory Lock เพื่อป้องกัน duplicate';

-- ============================================================================
-- PART 2: Atomic Function - Create Bonus Face Sheet with Stock Reservation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_bonus_face_sheet_with_reservation(
    p_delivery_date DATE,
    p_packages JSONB,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_created_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
    success BOOLEAN,
    face_sheet_id BIGINT,
    face_sheet_no VARCHAR,
    total_packages INTEGER,
    total_items INTEGER,
    total_orders INTEGER,
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
    v_total_items INTEGER := 0;
    v_total_orders INTEGER := 0;
    v_items_reserved INTEGER := 0;
    v_reserve_result RECORD;
    v_package JSONB;
    v_package_id BIGINT;
    v_item JSONB;
    v_barcode_id VARCHAR;
    v_package_number INTEGER := 0;
    v_unmapped_skus TEXT[] := ARRAY[]::TEXT[];
    v_sku_id VARCHAR;
BEGIN
    -- ========================================
    -- STEP 1: Validate Input
    -- ========================================
    
    IF p_packages IS NULL OR jsonb_array_length(p_packages) = 0 THEN
        RAISE EXCEPTION 'ไม่มีข้อมูลแพ็คสินค้า';
    END IF;
    
    -- Validate: ตรวจสอบว่าทุก SKU มี preparation area mapping
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
    LOOP
        IF v_package->'items' IS NOT NULL THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_package->'items')
            LOOP
                v_sku_id := v_item->>'product_code';
                IF v_sku_id IS NOT NULL THEN
                    -- Check if SKU has mapping
                    IF NOT EXISTS (
                        SELECT 1 FROM sku_preparation_area_mapping
                        WHERE sku_id = v_sku_id
                        AND warehouse_id = p_warehouse_id
                    ) THEN
                        v_unmapped_skus := array_append(v_unmapped_skus, v_sku_id);
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
    
    IF array_length(v_unmapped_skus, 1) > 0 THEN
        RAISE EXCEPTION 'SKU ต่อไปนี้ยังไม่ได้กำหนดบ้านหยิบ: % กรุณาตั้งค่าที่หน้า Master Data > Preparation Area ก่อนสร้างใบปะหน้า', 
            array_to_string(v_unmapped_skus, ', ');
    END IF;
    
    -- ========================================
    -- STEP 2: Generate Bonus Face Sheet Number (with Advisory Lock)
    -- ========================================
    
    v_face_sheet_no := generate_bonus_face_sheet_no_with_lock();
    
    -- ========================================
    -- STEP 3: Calculate Totals
    -- ========================================
    
    v_total_packages := jsonb_array_length(p_packages);
    
    SELECT 
        SUM(jsonb_array_length(pkg->'items')),
        COUNT(DISTINCT pkg->>'order_id')
    INTO v_total_items, v_total_orders
    FROM jsonb_array_elements(p_packages) pkg
    WHERE pkg->'items' IS NOT NULL;
    
    -- ========================================
    -- STEP 4: Create Bonus Face Sheet Header
    -- ========================================
    
    INSERT INTO bonus_face_sheets (
        face_sheet_no,
        warehouse_id,
        delivery_date,
        status,
        total_packages,
        total_items,
        total_orders,
        created_by,
        created_at
    ) VALUES (
        v_face_sheet_no,
        p_warehouse_id,
        p_delivery_date,
        'generated',
        v_total_packages,
        v_total_items,
        v_total_orders,
        p_created_by,
        CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_face_sheet_id;
    
    IF v_face_sheet_id IS NULL THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างใบปะหน้าของแถมได้';
    END IF;
    
    -- ========================================
    -- STEP 5: Create Packages and Items
    -- ========================================
    
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
    LOOP
        v_package_number := v_package_number + 1;
        v_barcode_id := v_face_sheet_no || '-P' || LPAD(v_package_number::TEXT, 3, '0');
        
        -- Insert package
        INSERT INTO bonus_face_sheet_packages (
            face_sheet_id,
            package_number,
            barcode_id,
            order_id,
            order_no,
            customer_id,
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
            (v_package->>'order_id')::INTEGER,
            v_package->>'order_no',
            v_package->>'customer_code',
            v_package->>'shop_name',
            v_package->>'address',
            v_package->>'province',
            v_package->>'contact_info',
            v_package->>'phone',
            v_package->>'hub',
            v_package->>'delivery_type',
            COALESCE(v_package->>'remark', ''),
            COALESCE(v_package->>'sales_territory', ''),
            COALESCE(v_package->>'trip_number', ''),
            COALESCE(v_package->>'pack_no', ''),
            jsonb_array_length(COALESCE(v_package->'items', '[]'::JSONB)),
            CURRENT_TIMESTAMP
        )
        RETURNING id INTO v_package_id;
        
        -- Insert items
        IF v_package->'items' IS NOT NULL AND jsonb_array_length(v_package->'items') > 0 THEN
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
                (item->>'order_item_id')::INTEGER,
                item->>'product_code',
                item->>'product_code',
                item->>'product_name',
                (item->>'quantity')::NUMERIC,
                (item->>'quantity')::NUMERIC,
                'ชิ้น',
                'ชิ้น',
                (item->>'weight')::NUMERIC,
                'pending',
                CURRENT_TIMESTAMP
            FROM jsonb_array_elements(v_package->'items') item;
        END IF;
    END LOOP;
    
    -- ========================================
    -- STEP 6: Reserve Stock (CRITICAL - Must Succeed)
    -- ========================================
    
    -- Call existing reserve function (now with FOR UPDATE from Migration 220)
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_bonus_face_sheet_items(
        p_bonus_face_sheet_id := v_face_sheet_id,
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
    -- STEP 7: Update Order Status to 'confirmed'
    -- ========================================
    
    UPDATE wms_orders
    SET 
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE order_type = 'special'
    AND order_id IN (
        SELECT DISTINCT (pkg->>'order_id')::INTEGER
        FROM jsonb_array_elements(p_packages) pkg
        WHERE pkg->>'order_id' IS NOT NULL
    )
    AND status = 'draft';
    
    -- ========================================
    -- STEP 8: Return Success
    -- ========================================
    
    RETURN QUERY SELECT 
        TRUE,
        v_face_sheet_id,
        v_face_sheet_no,
        v_total_packages,
        v_total_items,
        v_total_orders,
        v_items_reserved,
        format('สร้างใบปะหน้าของแถม %s สำเร็จ (%s แพ็ค, %s รายการ, จองสต็อค %s รายการ)', 
               v_face_sheet_no, v_total_packages, v_total_items, v_items_reserved)::TEXT,
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

COMMENT ON FUNCTION create_bonus_face_sheet_with_reservation IS 
'สร้างใบปะหน้าของแถมพร้อมจองสต็อคแบบ atomic - ถ้า ANY step fail จะ ROLLBACK ทั้งหมด (BUG-002 Fix)';

-- ============================================================================
-- PART 3: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION generate_bonus_face_sheet_no_with_lock TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_bonus_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ============================================================================
-- PART 4: Testing Query (Comment out in production)
-- ============================================================================

-- Test the function:
-- SELECT * FROM create_bonus_face_sheet_with_reservation(
--     p_warehouse_id := 'WH001',
--     p_delivery_date := '2026-01-20',
--     p_packages := '[
--         {
--             "order_id": 123,
--             "order_no": "ORD-001",
--             "customer_code": "C001",
--             "shop_name": "ร้านทดสอบ",
--             "items": [
--                 {
--                     "order_item_id": 456,
--                     "product_code": "SKU001",
--                     "product_name": "สินค้าทดสอบ",
--                     "quantity": 10,
--                     "weight": 5.5
--                 }
--             ]
--         }
--     ]'::JSONB,
--     p_created_by := 'test-user'
-- );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

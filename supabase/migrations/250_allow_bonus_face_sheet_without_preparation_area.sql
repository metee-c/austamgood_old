-- ============================================================================
-- Migration: 250_allow_bonus_face_sheet_without_preparation_area.sql
-- Description: อนุญาตให้สร้างใบปะหน้าของแถมได้แม้ SKU ยังไม่มีบ้านหยิบ
--
-- เปลี่ยนแปลง:
-- - เปลี่ยนจาก RAISE EXCEPTION เป็น return warning พร้อม SKU list
-- - เพิ่ม parameter p_skip_preparation_check เพื่อข้ามการตรวจสอบ
-- - Return unmapped_skus และ warning message
-- - ถ้า skip = TRUE จะไม่จองสต็อคสำหรับ SKU ที่ไม่มีบ้านหยิบ
-- ============================================================================

-- DROP existing function first
DROP FUNCTION IF EXISTS create_bonus_face_sheet_with_reservation(DATE, JSONB, VARCHAR, VARCHAR);

-- CREATE new function with updated signature
CREATE OR REPLACE FUNCTION create_bonus_face_sheet_with_reservation(
    p_delivery_date DATE,
    p_packages JSONB,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_created_by VARCHAR DEFAULT 'System',
    p_skip_preparation_check BOOLEAN DEFAULT FALSE  -- ✅ NEW: เพิ่ม parameter นี้
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
    error_details JSONB,
    unmapped_skus TEXT[],  -- ✅ NEW: รายการ SKU ที่ไม่มีบ้านหยิบ
    has_unmapped_skus BOOLEAN  -- ✅ NEW: มี SKU ที่ไม่มีบ้านหยิบหรือไม่
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

    -- ✅ CHANGED: ตรวจสอบว่าทุก SKU มี preparation area mapping
    -- แต่ไม่ RAISE EXCEPTION ทันที - เก็บรายการไว้ก่อน
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

    -- ✅ CHANGED: ถ้ามี unmapped SKU และไม่ได้ skip check → return warning
    IF array_length(v_unmapped_skus, 1) > 0 AND NOT p_skip_preparation_check THEN
        RETURN QUERY SELECT
            FALSE,  -- success = FALSE (ยังไม่ได้สร้าง)
            NULL::BIGINT,
            NULL::VARCHAR,
            0,
            0,
            0,
            0,
            'SKU ต่อไปนี้ยังไม่ได้กำหนดบ้านหยิบ กรุณายืนยันว่าต้องการสร้างใบปะหน้าต่อหรือไม่'::TEXT,
            NULL::JSONB,
            v_unmapped_skus,  -- ส่ง SKU list กลับไป
            TRUE;  -- has_unmapped_skus = TRUE
        RETURN;
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

        v_barcode_id := v_face_sheet_no || '-P' || LPAD(CAST(v_package_number AS TEXT), 3, '0');

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

    -- ✅ CHANGED: ถ้า skip check = TRUE และมี unmapped SKU
    -- → จองเฉพาะ SKU ที่มี preparation area เท่านั้น
    IF p_skip_preparation_check AND array_length(v_unmapped_skus, 1) > 0 THEN
        -- ลบ items ที่เป็น unmapped SKU ออกก่อนจองสต็อค
        DELETE FROM bonus_face_sheet_items
        WHERE face_sheet_id = v_face_sheet_id
        AND product_code = ANY(v_unmapped_skus);

        -- อัพเดท total_items ใน header
        UPDATE bonus_face_sheets
        SET total_items = (
            SELECT COUNT(*) FROM bonus_face_sheet_items
            WHERE face_sheet_id = v_face_sheet_id
        )
        WHERE id = v_face_sheet_id;
    END IF;

    -- Call existing reserve function
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_bonus_face_sheet_items(
        p_bonus_face_sheet_id := v_face_sheet_id,
        p_warehouse_id := p_warehouse_id,
        p_reserved_by := p_created_by
    );

    -- Check if reservation succeeded
    IF NOT v_reserve_result.success THEN
        RAISE EXCEPTION 'การจองสต็อคไม่สำเร็จ: %',
            v_reserve_result.message;
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
        NULL::JSONB,
        v_unmapped_skus,  -- ส่ง SKU list กลับไป (อาจจะเป็น empty array)
        (array_length(v_unmapped_skus, 1) > 0);  -- has_unmapped_skus

EXCEPTION
    WHEN OTHERS THEN
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
            ),
            ARRAY[]::TEXT[],
            FALSE;
END;
$$;

COMMENT ON FUNCTION create_bonus_face_sheet_with_reservation IS
'สร้างใบปะหน้าของแถมพร้อมจองสต็อคแบบ atomic - อนุญาตให้ข้าม preparation check (Migration 250)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_bonus_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================================
-- Migration: 251_keep_unmapped_items_skip_reservation.sql
-- Description: เก็บรายการที่ไม่มี preparation area mapping ไว้ในใบปะหน้า
--              แต่ข้ามการจองสต็อกสำหรับรายการเหล่านั้น
--
-- เปลี่ยนแปลง:
-- 1. ลบส่วนที่ DELETE items ที่ไม่มี mapping ออก
-- 2. แก้ไข reserve_stock_for_bonus_face_sheet_items() ให้ข้าม SKU ที่ไม่มี mapping
-- ============================================================================

-- ========================================
-- STEP 1: อัพเดท create_bonus_face_sheet_with_reservation()
-- ========================================

DROP FUNCTION IF EXISTS create_bonus_face_sheet_with_reservation(DATE, JSONB, VARCHAR, VARCHAR, BOOLEAN);

CREATE OR REPLACE FUNCTION create_bonus_face_sheet_with_reservation(
    p_delivery_date DATE,
    p_packages JSONB,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_created_by VARCHAR DEFAULT 'System',
    p_skip_preparation_check BOOLEAN DEFAULT FALSE
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
    unmapped_skus TEXT[],
    has_unmapped_skus BOOLEAN
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

    -- ตรวจสอบว่าทุก SKU มี preparation area mapping
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
    LOOP
        IF v_package->'items' IS NOT NULL THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_package->'items')
            LOOP
                v_sku_id := v_item->>'product_code';
                IF v_sku_id IS NOT NULL THEN
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

    -- ถ้ามี unmapped SKU และไม่ได้ skip check → return warning
    IF array_length(v_unmapped_skus, 1) > 0 AND NOT p_skip_preparation_check THEN
        RETURN QUERY SELECT
            FALSE,
            NULL::BIGINT,
            NULL::VARCHAR,
            0,
            0,
            0,
            0,
            'SKU ต่อไปนี้ยังไม่ได้กำหนดบ้านหยิบ กรุณายืนยันว่าต้องการสร้างใบปะหน้าต่อหรือไม่'::TEXT,
            NULL::JSONB,
            v_unmapped_skus,
            TRUE;
        RETURN;
    END IF;

    -- ========================================
    -- STEP 2: Generate Bonus Face Sheet Number
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

        -- Insert items (✅ เก็บทุกรายการ รวมถึงที่ไม่มี mapping)
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
    -- STEP 6: Reserve Stock
    -- ========================================
    -- ✅ CHANGED: ไม่ลบ items ที่ไม่มี mapping
    -- ให้ reserve function ข้ามรายการที่ไม่มี mapping เอง

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
        v_unmapped_skus,
        (array_length(v_unmapped_skus, 1) > 0);

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
'สร้างใบปะหน้าของแถมพร้อมจองสต็อคแบบ atomic - เก็บรายการที่ไม่มี mapping แต่ข้ามการจอง (Migration 251)';

GRANT EXECUTE ON FUNCTION create_bonus_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ========================================
-- STEP 2: อัพเดท reserve_stock_for_bonus_face_sheet_items()
-- ========================================

DROP FUNCTION IF EXISTS reserve_stock_for_bonus_face_sheet_items(BIGINT, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION reserve_stock_for_bonus_face_sheet_items(
    p_bonus_face_sheet_id BIGINT,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
    success BOOLEAN,
    items_reserved INTEGER,
    message TEXT,
    error_details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item RECORD;
    v_items_reserved INTEGER := 0;
    v_balances RECORD;
    v_remaining_qty NUMERIC;
    v_qty_to_reserve NUMERIC;
    v_reservation_id BIGINT;
    v_has_mapping BOOLEAN;
BEGIN
    -- วนลูปจองสต็อคทีละ item
    FOR v_item IN
        SELECT
            bfsi.id AS item_id,
            bfsi.product_code,
            bfsi.product_name,
            bfsi.quantity_to_pick,
            bfsi.source_location_id
        FROM bonus_face_sheet_items bfsi
        WHERE bfsi.face_sheet_id = p_bonus_face_sheet_id
        AND bfsi.status = 'pending'
        ORDER BY bfsi.id
    LOOP
        -- ✅ NEW: ตรวจสอบว่า SKU มี preparation area mapping หรือไม่
        SELECT EXISTS (
            SELECT 1 FROM sku_preparation_area_mapping
            WHERE sku_id = v_item.product_code
            AND warehouse_id = p_warehouse_id
        ) INTO v_has_mapping;

        -- ✅ NEW: ถ้าไม่มี mapping → ข้ามการจอง (continue to next item)
        IF NOT v_has_mapping THEN
            RAISE NOTICE 'ข้ามการจองสต็อกสำหรับ SKU %: ไม่มี preparation area mapping', v_item.product_code;
            CONTINUE;
        END IF;

        -- มี mapping → ดำเนินการจองสต็อกตามปกติ
        v_remaining_qty := v_item.quantity_to_pick;

        -- Query balances (FEFO + FIFO)
        FOR v_balances IN
            SELECT
                bal.id AS balance_id,
                bal.location_id,
                bal.available_piece_qty,
                bal.production_date,
                bal.expiry_date,
                bal.lot_no
            FROM wms_inventory_balances bal
            WHERE bal.sku_id = v_item.product_code
            AND bal.warehouse_id = p_warehouse_id
            AND (
                v_item.source_location_id IS NULL
                OR bal.location_id = v_item.source_location_id
            )
            AND bal.available_piece_qty > 0
            ORDER BY
                bal.expiry_date ASC NULLS LAST,
                bal.created_at ASC
        LOOP
            EXIT WHEN v_remaining_qty <= 0;

            v_qty_to_reserve := LEAST(v_remaining_qty, v_balances.available_piece_qty);

            -- Reserve stock
            UPDATE wms_inventory_balances
            SET
                reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                available_piece_qty = available_piece_qty - v_qty_to_reserve,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_balances.balance_id;

            -- Record reservation
            INSERT INTO bonus_face_sheet_item_reservations (
                face_sheet_id,
                item_id,
                balance_id,
                sku_id,
                location_id,
                reserved_qty,
                production_date,
                expiry_date,
                lot_no,
                status,
                reserved_by,
                reserved_at
            ) VALUES (
                p_bonus_face_sheet_id,
                v_item.item_id,
                v_balances.balance_id,
                v_item.product_code,
                v_balances.location_id,
                v_qty_to_reserve,
                v_balances.production_date,
                v_balances.expiry_date,
                v_balances.lot_no,
                'reserved',
                p_reserved_by,
                CURRENT_TIMESTAMP
            )
            RETURNING id INTO v_reservation_id;

            v_remaining_qty := v_remaining_qty - v_qty_to_reserve;

            RAISE NOTICE 'จองสต็อค: SKU=%, Balance=%, Qty=%, Remaining=%',
                v_item.product_code, v_balances.balance_id, v_qty_to_reserve, v_remaining_qty;
        END LOOP;

        -- ตรวจสอบว่าจองครบหรือไม่ (สำหรับ SKU ที่มี mapping)
        IF v_remaining_qty > 0 THEN
            RAISE EXCEPTION 'สต็อคไม่เพียงพอสำหรับ SKU % (ต้องการ %, ขาด %)',
                v_item.product_code, v_item.quantity_to_pick, v_remaining_qty;
        END IF;

        v_items_reserved := v_items_reserved + 1;
    END LOOP;

    -- Return success
    RETURN QUERY SELECT
        TRUE,
        v_items_reserved,
        format('จองสต็อคสำเร็จ %s รายการ', v_items_reserved)::TEXT,
        NULL::JSONB;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE,
            0,
            SQLERRM::TEXT,
            jsonb_build_object(
                'error_code', SQLSTATE,
                'error_message', SQLERRM
            );
END;
$$;

COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
'จองสต็อคสำหรับใบปะหน้าของแถม - ข้าม SKU ที่ไม่มี preparation area mapping (Migration 251)';

GRANT EXECUTE ON FUNCTION reserve_stock_for_bonus_face_sheet_items TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

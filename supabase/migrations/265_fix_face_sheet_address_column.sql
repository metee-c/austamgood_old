-- ============================================================================
-- Migration: 265_fix_face_sheet_address_column.sql
-- Description: แก้ไข column address → shipping_address ใน face sheet creation
-- 
-- BUG: column mc.address does not exist
-- - master_customer ไม่มี column "address"
-- - ต้องใช้ "shipping_address" แทน
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
    
    IF v_face_sheet_id IS NULL THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างใบปะหน้าได้';
    END IF;
    
    -- ========================================
    -- STEP 4: Create Face Sheet Packages and Items from Orders
    -- ✅ FIX: Create 1 package per PACK (not per order_item)
    -- ✅ FIX: Use shipping_address instead of address
    -- ========================================
    
    -- Calculate how many packs are needed for each order item
    WITH order_item_packs AS (
        SELECT 
            o.order_id,
            o.order_no,
            o.customer_id,
            oi.order_item_id,
            oi.sku_id,
            oi.order_qty,
            ms.sku_name,
            ms.qty_per_pack,
            ms.weight_per_pack_kg,
            mc.customer_name,
            mc.shipping_address,  -- ✅ FIX: Changed from address to shipping_address
            mc.province,
            mc.contact_person,    -- ✅ FIX: Changed from contact_name to contact_person
            mc.phone,
            mc.hub,
            -- ✅ Calculate number of packs needed
            CEIL(oi.order_qty::NUMERIC / COALESCE(NULLIF(ms.qty_per_pack, 0), 1))::INTEGER as packs_needed,
            -- Determine size based on weight
            CASE 
                WHEN COALESCE(ms.weight_per_pack_kg, 0) > 7 THEN 'large'
                ELSE 'small'
            END as size_category
        FROM wms_orders o
        JOIN wms_order_items oi ON oi.order_id = o.order_id
        JOIN master_sku ms ON ms.sku_id = oi.sku_id
        LEFT JOIN master_customer mc ON mc.customer_id = o.customer_id
        WHERE o.order_type = 'express'
        AND o.delivery_date = p_delivery_date
        AND (p_order_ids IS NULL OR o.order_id = ANY(p_order_ids))
        AND o.status IN ('draft', 'confirmed')
    ),
    -- ✅ Generate multiple rows for each pack using generate_series
    expanded_packs AS (
        SELECT 
            oip.*,
            pack_num as pack_sequence
        FROM order_item_packs oip
        CROSS JOIN LATERAL generate_series(1, oip.packs_needed) as pack_num
    ),
    -- Add sequential package numbers across all packs
    numbered_packs AS (
        SELECT 
            ep.*,
            ROW_NUMBER() OVER (ORDER BY ep.order_id, ep.order_item_id, ep.pack_sequence) as global_package_number
        FROM expanded_packs ep
    ),
    -- Create package data with all required fields
    package_data AS (
        SELECT 
            v_face_sheet_id as fs_id,  -- ✅ FIX: Renamed to avoid ambiguity
            np.global_package_number as package_number,
            'FS-PKG-' || v_face_sheet_id || '-' || np.global_package_number as barcode_id,
            np.order_no,
            np.order_id,
            np.customer_id,
            np.customer_name as shop_name,
            np.sku_id as product_code,
            np.sku_name as product_name,
            np.size_category,
            COALESCE(np.weight_per_pack_kg, 0) as package_weight,
            np.shipping_address as address,  -- ✅ FIX: Use shipping_address
            np.province,
            np.contact_person as contact_name,  -- ✅ FIX: Use contact_person
            np.phone,
            np.hub,
            np.order_item_id,
            np.order_qty,
            np.pack_sequence
        FROM numbered_packs np
    ),
    -- Insert packages
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
            pd.fs_id,  -- ✅ FIX: Use renamed column
            pd.package_number,
            pd.barcode_id,
            pd.order_no,
            pd.order_id,
            pd.customer_id,
            pd.shop_name,
            pd.product_code,
            pd.product_name,
            pd.size_category,
            pd.package_weight,
            pd.address,
            pd.province,
            pd.contact_name,
            pd.phone,
            pd.hub
        FROM package_data pd
        RETURNING id, barcode_id, order_id, order_no, product_code
    )
    -- ✅ Insert face_sheet_items - one per package (not per order_item)
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
        pd.fs_id,  -- ✅ FIX: Use renamed column
        ip.id,
        pd.order_id,
        pd.order_item_id,
        pd.product_code,
        pd.order_qty, -- ✅ Store original order_qty for reference
        pd.size_category,
        'pending',
        CURRENT_TIMESTAMP
    FROM package_data pd
    JOIN inserted_packages ip ON ip.barcode_id = pd.barcode_id;
    
    -- Count packages
    SELECT 
        COUNT(*),
        SUM(CASE WHEN fsi.size = 'small' THEN 1 ELSE 0 END),
        SUM(CASE WHEN fsi.size = 'large' THEN 1 ELSE 0 END)
    INTO v_total_packages, v_small_size_count, v_large_size_count
    FROM face_sheet_items fsi
    WHERE fsi.face_sheet_id = v_face_sheet_id;
    
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
        format('สร้างใบปะหน้า %s สำเร็จ (%s แพ็ค, จองสต็อค %s รายการ)', 
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
                'error_message', SQLERRM
            );
END;
$$;

COMMENT ON FUNCTION create_face_sheet_with_reservation IS 
'สร้างใบปะหน้าพร้อมจองสต็อคแบบ atomic - สร้าง 1 package ต่อ 1 pack (Fix: Address Column Bug)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_face_sheet_with_reservation TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

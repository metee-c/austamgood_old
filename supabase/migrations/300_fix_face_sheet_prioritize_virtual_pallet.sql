-- ============================================================================
-- Migration: 300_fix_face_sheet_prioritize_virtual_pallet.sql
-- Description: แก้ไข reserve_stock_for_face_sheet_items ให้จอง Virtual Pallet ก่อน
--
-- BUG: Face Sheet จองจากพาเลทจริงก่อน (FEFO/FIFO) ทำให้เมื่อพาเลทหมดสต็อก
--      การหยิบล้มเหลวด้วย "insufficient stock" error
--
-- FIX: เปลี่ยนลำดับการจอง:
--      1. จอง Virtual Pallet ก่อน (ติดลบได้)
--      2. ถ้า Virtual Pallet ไม่มี หรือไม่พอ ค่อยจองจากพาเลทจริง
--
-- REASON: Face Sheet ควรใช้ Virtual Pallet เพื่อรองรับการติดลบ
--         เพราะสินค้าจะถูกเติมเข้า Prep Area ภายหลัง
-- ============================================================================

-- Drop the function first
DROP FUNCTION IF EXISTS reserve_stock_for_face_sheet_items(BIGINT, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(
    p_face_sheet_id BIGINT,
    p_warehouse_id VARCHAR DEFAULT 'WH001',
    p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE(
    success BOOLEAN,
    items_reserved INTEGER,
    message TEXT,
    insufficient_stock_items JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_qty_to_reserve NUMERIC;
    v_qty_reserved NUMERIC := 0;
    v_pack_to_reserve NUMERIC;
    v_items_count INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_prep_area_location VARCHAR;
    v_virtual_pallet_id VARCHAR;
    v_virtual_balance_id BIGINT;
    v_existing_balance RECORD;
BEGIN
    -- Get items that need stock reservation
    FOR v_item IN
        SELECT
            fsi.id as item_id,
            fsi.face_sheet_id,
            fsi.sku_id,
            COALESCE(fsi.quantity, 0) as quantity,
            ms.qty_per_pack,
            -- Use hub from face_sheet_packages directly as location
            COALESCE(fsp.hub, 'PK001') as prep_area_location
        FROM face_sheet_items fsi
        JOIN master_sku ms ON ms.sku_id = fsi.sku_id
        LEFT JOIN face_sheet_packages fsp ON fsp.id = fsi.package_id
        WHERE fsi.face_sheet_id = p_face_sheet_id
        AND fsi.status = 'pending'
    LOOP
        v_qty_to_reserve := v_item.quantity;
        v_pack_to_reserve := CEIL(v_item.quantity / GREATEST(COALESCE(v_item.qty_per_pack, 1), 1));
        v_qty_reserved := 0;
        v_prep_area_location := v_item.prep_area_location;

        -- ========================================
        -- ✅ FIX: STEP 1 - หา Prep Area (บ้านหยิบ) ของ SKU
        -- ========================================
        -- หา prep area จาก sku_preparation_area_mapping
        SELECT pa.area_code INTO v_prep_area_location
        FROM sku_preparation_area_mapping spam
        JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
        WHERE spam.sku_id = v_item.sku_id
        AND spam.warehouse_id = p_warehouse_id
        AND pa.status = 'active'
        ORDER BY spam.is_primary DESC, spam.priority ASC
        LIMIT 1;
        
        -- ถ้าไม่เจอ mapping ให้ใช้ PK001 เป็น default
        IF v_prep_area_location IS NULL THEN
            v_prep_area_location := 'PK001';
        END IF;

        -- Generate Virtual Pallet ID
        v_virtual_pallet_id := 'VIRTUAL-' || v_item.sku_id;

        -- Check if Virtual Pallet exists
        SELECT balance_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty
        INTO v_existing_balance
        FROM wms_inventory_balances
        WHERE warehouse_id = p_warehouse_id
        AND location_id = v_prep_area_location
        AND sku_id = v_item.sku_id
        AND pallet_id = v_virtual_pallet_id
        FOR UPDATE;

        IF v_existing_balance.balance_id IS NOT NULL THEN
            -- Virtual Pallet exists - update it (can go negative)
            UPDATE wms_inventory_balances
            SET total_piece_qty = total_piece_qty - v_qty_to_reserve,
                total_pack_qty = total_pack_qty - v_pack_to_reserve,
                reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
                reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
                updated_at = CURRENT_TIMESTAMP
            WHERE balance_id = v_existing_balance.balance_id
            RETURNING balance_id INTO v_virtual_balance_id;
        ELSE
            -- Virtual Pallet doesn't exist - create it (negative balance)
            INSERT INTO wms_inventory_balances (
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                total_piece_qty,
                reserved_piece_qty,
                total_pack_qty,
                reserved_pack_qty,
                created_at,
                updated_at
            )
            VALUES (
                p_warehouse_id,
                v_prep_area_location,
                v_item.sku_id,
                v_virtual_pallet_id,
                -v_qty_to_reserve,  -- ติดลบ
                v_qty_to_reserve,   -- จอง
                -v_pack_to_reserve,
                v_pack_to_reserve,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING balance_id INTO v_virtual_balance_id;
        END IF;

        -- Create reservation for Virtual Pallet
        INSERT INTO face_sheet_item_reservations (
            face_sheet_item_id,
            balance_id,
            reserved_piece_qty,
            reserved_pack_qty,
            status,
            reserved_at,
            reserved_by
        ) VALUES (
            v_item.item_id,
            v_virtual_balance_id,
            v_qty_to_reserve,
            v_pack_to_reserve,
            'reserved',
            CURRENT_TIMESTAMP,
            p_reserved_by
        );

        -- Create ledger entry for Virtual Pallet reservation
        INSERT INTO wms_inventory_ledger (
            movement_at,
            transaction_type,
            direction,
            warehouse_id,
            location_id,
            sku_id,
            pallet_id,
            pack_qty,
            piece_qty,
            reference_no,
            reference_doc_type,
            reference_doc_id,
            remarks,
            skip_balance_sync,
            created_at
        ) VALUES (
            CURRENT_TIMESTAMP,
            'VIRTUAL_RESERVE',
            'out',
            p_warehouse_id,
            v_prep_area_location,
            v_item.sku_id,
            v_virtual_pallet_id,
            v_pack_to_reserve,
            v_qty_to_reserve,
            'FS-' || p_face_sheet_id,
            'face_sheet',
            p_face_sheet_id,
            format('Virtual Reservation: Face Sheet %s, SKU %s, จำนวน %s ชิ้น', 
                   p_face_sheet_id, v_item.sku_id, v_qty_to_reserve),
            TRUE,  -- skip trigger เพราะเราอัพเดท balance เองแล้ว
            CURRENT_TIMESTAMP
        );

        v_qty_reserved := v_qty_to_reserve;

        RAISE NOTICE 'Created Virtual Reservation: SKU=%, Location=%, Qty=%', 
            v_item.sku_id, v_prep_area_location, v_qty_to_reserve;

        -- Update face_sheet_item
        UPDATE face_sheet_items
        SET source_location_id = v_prep_area_location,
            quantity_to_pick = v_qty_to_reserve,
            status = 'pending'
        WHERE id = v_item.item_id;

        v_items_count := v_items_count + 1;
    END LOOP;

    -- Return result
    IF v_items_count = 0 THEN
        RETURN QUERY SELECT
            FALSE,
            0,
            'ไม่พบรายการสินค้าที่ต้องจองสต็อค'::TEXT,
            '[]'::JSONB;
    ELSE
        RETURN QUERY SELECT
            TRUE,
            v_items_count,
            format('จองสต็อคสำเร็จ %s รายการ (ใช้ Virtual Pallet)', v_items_count)::TEXT,
            v_insufficient_items;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            FALSE,
            0,
            SQLERRM::TEXT,
            '[]'::JSONB;
END;
$$;

COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS
'จองสต็อคสำหรับใบปะหน้า - ใช้ Virtual Pallet เท่านั้น (Migration 300)';

GRANT EXECUTE ON FUNCTION reserve_stock_for_face_sheet_items TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

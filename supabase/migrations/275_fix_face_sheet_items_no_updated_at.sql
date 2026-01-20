-- ============================================================================
-- Migration: 275_fix_face_sheet_items_no_updated_at.sql
-- Description: แก้ไข reserve_stock_for_face_sheet_items - ลบ updated_at ที่ไม่มีอยู่
--
-- BUG: face_sheet_items ไม่มี column updated_at แต่ function พยายาม UPDATE column นี้
--
-- FIX: ลบการ UPDATE updated_at ออกจาก face_sheet_items
-- ============================================================================

-- Drop the function first to ensure clean replacement
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
    v_qty_short NUMERIC;
    v_pack_short NUMERIC;
    v_items_count INTEGER := 0;
    v_insufficient_items JSONB := '[]'::JSONB;
    v_has_insufficient BOOLEAN := FALSE;
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

        -- Try to reserve from available balances (FEFO order)
        FOR v_balance IN
            SELECT
                balance_id,
                total_piece_qty,
                total_pack_qty,
                reserved_piece_qty,
                reserved_pack_qty,
                (total_piece_qty - reserved_piece_qty) as available_qty
            FROM wms_inventory_balances
            WHERE warehouse_id = p_warehouse_id
            AND sku_id = v_item.sku_id
            AND (total_piece_qty - reserved_piece_qty) > 0
            ORDER BY
                COALESCE(expiry_date, '9999-12-31') ASC,
                COALESCE(production_date, '1900-01-01') ASC,
                created_at ASC
            FOR UPDATE
        LOOP
            EXIT WHEN v_qty_reserved >= v_qty_to_reserve;

            DECLARE
                v_reserve_qty NUMERIC;
                v_reserve_pack NUMERIC;
            BEGIN
                v_reserve_qty := LEAST(v_balance.available_qty, v_qty_to_reserve - v_qty_reserved);
                v_reserve_pack := CEIL(v_reserve_qty / GREATEST(COALESCE(v_item.qty_per_pack, 1), 1));

                -- Update balance - reserve the stock
                UPDATE wms_inventory_balances
                SET reserved_piece_qty = reserved_piece_qty + v_reserve_qty,
                    reserved_pack_qty = reserved_pack_qty + v_reserve_pack,
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance.balance_id;

                -- Create reservation record
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
                    v_balance.balance_id,
                    v_reserve_qty,
                    v_reserve_pack,
                    'reserved',
                    CURRENT_TIMESTAMP,
                    p_reserved_by
                );

                v_qty_reserved := v_qty_reserved + v_reserve_qty;
            END;
        END LOOP;

        -- Check if we have insufficient stock
        IF v_qty_reserved < v_qty_to_reserve THEN
            v_qty_short := v_qty_to_reserve - v_qty_reserved;
            v_pack_short := CEIL(v_qty_short / GREATEST(COALESCE(v_item.qty_per_pack, 1), 1));

            -- Add to insufficient items list
            v_insufficient_items := v_insufficient_items || jsonb_build_object(
                'item_id', v_item.item_id,
                'sku_id', v_item.sku_id,
                'required_qty', v_qty_to_reserve,
                'reserved_qty', v_qty_reserved,
                'short_qty', v_qty_short
            );

            -- Create virtual balance for the shortage
            BEGIN
                IF v_prep_area_location IS NULL THEN
                    v_prep_area_location := 'PK001';
                END IF;

                -- Generate Virtual Pallet ID (unique per SKU-location combination)
                v_virtual_pallet_id := 'VIRTUAL-' || v_item.sku_id;

                -- Use SELECT then INSERT/UPDATE instead of ON CONFLICT
                SELECT balance_id, total_piece_qty, total_pack_qty
                INTO v_existing_balance
                FROM wms_inventory_balances
                WHERE warehouse_id = p_warehouse_id
                AND location_id = v_prep_area_location
                AND sku_id = v_item.sku_id
                AND pallet_id = v_virtual_pallet_id
                FOR UPDATE;

                IF v_existing_balance.balance_id IS NOT NULL THEN
                    -- Update existing balance
                    UPDATE wms_inventory_balances
                    SET total_piece_qty = total_piece_qty - v_qty_short,
                        total_pack_qty = total_pack_qty - v_pack_short,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE balance_id = v_existing_balance.balance_id
                    RETURNING balance_id INTO v_virtual_balance_id;
                ELSE
                    -- Insert new balance
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
                        -v_qty_short,
                        0,
                        -v_pack_short,
                        0,
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
                    reserved_at
                ) VALUES (
                    v_item.item_id,
                    v_virtual_balance_id,
                    v_qty_short,
                    v_pack_short,
                    'reserved',
                    CURRENT_TIMESTAMP
                );

                v_qty_reserved := v_qty_reserved + v_qty_short;
                v_has_insufficient := TRUE;
            END;
        END IF;

        -- ✅ FIX: Remove updated_at - face_sheet_items doesn't have this column
        UPDATE face_sheet_items
        SET source_location_id = v_prep_area_location,
            quantity_to_pick = v_qty_to_reserve,
            status = CASE WHEN v_has_insufficient THEN 'pending' ELSE 'pending' END
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
            format('จองสต็อคสำเร็จ %s รายการ', v_items_count)::TEXT,
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
'จองสต็อคสำหรับใบปะหน้า - Fix: removed updated_at from face_sheet_items (Migration 275)';

GRANT EXECUTE ON FUNCTION reserve_stock_for_face_sheet_items TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

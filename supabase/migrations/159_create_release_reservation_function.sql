-- ============================================================================
-- Migration: 159_create_release_reservation_function.sql
-- Description: สร้าง Function สำหรับ Release Reservation กลับไปที่ Balance
-- Date: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: Function สำหรับ Release Reservation
-- ============================================================================

-- 1.1 Release reservation และคืน qty กลับไปที่ balance
CREATE OR REPLACE FUNCTION release_reservation(
    p_balance_id BIGINT,
    p_piece_qty NUMERIC,
    p_pack_qty NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_reserved_piece NUMERIC;
    v_current_reserved_pack NUMERIC;
    v_new_reserved_piece NUMERIC;
    v_new_reserved_pack NUMERIC;
BEGIN
    -- ดึงยอด reserved ปัจจุบัน
    SELECT reserved_piece_qty, reserved_pack_qty 
    INTO v_current_reserved_piece, v_current_reserved_pack
    FROM wms_inventory_balances
    WHERE balance_id = p_balance_id
    FOR UPDATE;  -- Lock row
    
    IF NOT FOUND THEN
        RAISE WARNING 'Balance % not found', p_balance_id;
        RETURN FALSE;
    END IF;
    
    -- คำนวณยอดใหม่ (ไม่ให้ติดลบ)
    v_new_reserved_piece := GREATEST(0, COALESCE(v_current_reserved_piece, 0) - p_piece_qty);
    v_new_reserved_pack := GREATEST(0, COALESCE(v_current_reserved_pack, 0) - p_pack_qty);
    
    -- อัปเดต balance
    UPDATE wms_inventory_balances
    SET 
        reserved_piece_qty = v_new_reserved_piece,
        reserved_pack_qty = v_new_reserved_pack,
        updated_at = NOW()
    WHERE balance_id = p_balance_id;
    
    RAISE NOTICE 'Released reservation: balance_id=%, piece_qty=%, pack_qty=%', 
        p_balance_id, p_piece_qty, p_pack_qty;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Function สำหรับ Release All Reservations ของ Order
-- ============================================================================

-- 2.1 Release ทุก picklist_item_reservations ของ Order
CREATE OR REPLACE FUNCTION release_order_picklist_reservations(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS INT AS $$
DECLARE
    v_reservation RECORD;
    v_count INT := 0;
BEGIN
    -- Loop ผ่านทุก reservation ที่ยังเป็น 'reserved'
    FOR v_reservation IN
        SELECT 
            pir.reservation_id,
            pir.balance_id,
            pir.reserved_piece_qty,
            pir.reserved_pack_qty
        FROM picklist_item_reservations pir
        JOIN picklist_items pi ON pir.picklist_item_id = pi.id
        WHERE pi.order_id = p_order_id
          AND pir.status = 'reserved'
    LOOP
        -- Release reservation
        PERFORM release_reservation(
            v_reservation.balance_id,
            v_reservation.reserved_piece_qty,
            v_reservation.reserved_pack_qty
        );
        
        -- Update reservation status
        UPDATE picklist_item_reservations
        SET 
            status = 'released',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = p_reason,
            updated_at = NOW()
        WHERE reservation_id = v_reservation.reservation_id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Released % picklist reservations for order %', v_count, p_order_id;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 Release ทุก face_sheet_item_reservations ของ Order
CREATE OR REPLACE FUNCTION release_order_face_sheet_reservations(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS INT AS $$
DECLARE
    v_reservation RECORD;
    v_count INT := 0;
BEGIN
    FOR v_reservation IN
        SELECT 
            fsir.reservation_id,
            fsir.balance_id,
            fsir.reserved_piece_qty,
            fsir.reserved_pack_qty
        FROM face_sheet_item_reservations fsir
        JOIN face_sheet_items fsi ON fsir.face_sheet_item_id = fsi.id
        WHERE fsi.order_id = p_order_id
          AND fsir.status = 'reserved'
    LOOP
        PERFORM release_reservation(
            v_reservation.balance_id,
            v_reservation.reserved_piece_qty,
            v_reservation.reserved_pack_qty
        );
        
        UPDATE face_sheet_item_reservations
        SET 
            status = 'released',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = p_reason,
            updated_at = NOW()
        WHERE reservation_id = v_reservation.reservation_id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Released % face sheet reservations for order %', v_count, p_order_id;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 Release ทุก bonus_face_sheet_item_reservations ของ Order (ผ่าน order_item_id)
CREATE OR REPLACE FUNCTION release_order_bonus_face_sheet_reservations(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS INT AS $$
DECLARE
    v_reservation RECORD;
    v_count INT := 0;
BEGIN
    FOR v_reservation IN
        SELECT 
            bfsir.reservation_id,
            bfsir.balance_id,
            bfsir.reserved_piece_qty,
            bfsir.reserved_pack_qty
        FROM bonus_face_sheet_item_reservations bfsir
        JOIN bonus_face_sheet_items bfsi ON bfsir.bonus_face_sheet_item_id = bfsi.id
        JOIN wms_order_items oi ON bfsi.order_item_id = oi.item_id
        WHERE oi.order_id = p_order_id
          AND bfsir.status = 'reserved'
    LOOP
        PERFORM release_reservation(
            v_reservation.balance_id,
            v_reservation.reserved_piece_qty,
            v_reservation.reserved_pack_qty
        );
        
        UPDATE bonus_face_sheet_item_reservations
        SET 
            status = 'released',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = p_reason,
            updated_at = NOW()
        WHERE reservation_id = v_reservation.reservation_id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Released % bonus face sheet reservations for order %', v_count, p_order_id;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.4 Master function: Release ALL reservations ของ Order
CREATE OR REPLACE FUNCTION release_all_order_reservations(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS JSONB AS $$
DECLARE
    v_picklist_count INT;
    v_face_sheet_count INT;
    v_bonus_count INT;
BEGIN
    v_picklist_count := release_order_picklist_reservations(p_order_id, p_user_id, p_reason);
    v_face_sheet_count := release_order_face_sheet_reservations(p_order_id, p_user_id, p_reason);
    v_bonus_count := release_order_bonus_face_sheet_reservations(p_order_id, p_user_id, p_reason);
    
    RETURN jsonb_build_object(
        'picklist_reservations_released', v_picklist_count,
        'face_sheet_reservations_released', v_face_sheet_count,
        'bonus_face_sheet_reservations_released', v_bonus_count,
        'total_released', v_picklist_count + v_face_sheet_count + v_bonus_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 3: Function สำหรับ Void Document Items ของ Order
-- ============================================================================

-- 3.1 Void picklist_items ของ Order
CREATE OR REPLACE FUNCTION void_order_picklist_items(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS JSONB AS $$
DECLARE
    v_count INT;
    v_picklist_ids BIGINT[];
BEGIN
    -- ดึง picklist_ids ที่ได้รับผลกระทบ
    SELECT ARRAY_AGG(DISTINCT picklist_id) INTO v_picklist_ids
    FROM picklist_items
    WHERE order_id = p_order_id
      AND voided_at IS NULL;
    
    -- Void items
    UPDATE picklist_items
    SET 
        status = 'voided',
        voided_at = NOW(),
        voided_by = p_user_id,
        void_reason = p_reason
    WHERE order_id = p_order_id
      AND voided_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Voided % picklist items for order %', v_count, p_order_id;
    
    RETURN jsonb_build_object(
        'items_voided', v_count,
        'affected_picklist_ids', v_picklist_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Void face_sheet_items ของ Order
CREATE OR REPLACE FUNCTION void_order_face_sheet_items(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS JSONB AS $$
DECLARE
    v_count INT;
    v_face_sheet_ids BIGINT[];
BEGIN
    SELECT ARRAY_AGG(DISTINCT face_sheet_id) INTO v_face_sheet_ids
    FROM face_sheet_items
    WHERE order_id = p_order_id
      AND voided_at IS NULL;
    
    UPDATE face_sheet_items
    SET 
        status = 'voided',
        voided_at = NOW(),
        voided_by = p_user_id,
        void_reason = p_reason
    WHERE order_id = p_order_id
      AND voided_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Voided % face sheet items for order %', v_count, p_order_id;
    
    RETURN jsonb_build_object(
        'items_voided', v_count,
        'affected_face_sheet_ids', v_face_sheet_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 Void bonus_face_sheet_items ของ Order (ผ่าน order_item_id)
CREATE OR REPLACE FUNCTION void_order_bonus_face_sheet_items(
    p_order_id BIGINT,
    p_user_id BIGINT,
    p_reason TEXT DEFAULT 'Rollback'
) RETURNS JSONB AS $$
DECLARE
    v_count INT;
    v_face_sheet_ids BIGINT[];
BEGIN
    SELECT ARRAY_AGG(DISTINCT bfsi.face_sheet_id) INTO v_face_sheet_ids
    FROM bonus_face_sheet_items bfsi
    JOIN wms_order_items oi ON bfsi.order_item_id = oi.item_id
    WHERE oi.order_id = p_order_id
      AND bfsi.voided_at IS NULL;
    
    UPDATE bonus_face_sheet_items bfsi
    SET 
        status = 'voided',
        voided_at = NOW(),
        voided_by = p_user_id,
        void_reason = p_reason
    FROM wms_order_items oi
    WHERE bfsi.order_item_id = oi.item_id
      AND oi.order_id = p_order_id
      AND bfsi.voided_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Voided % bonus face sheet items for order %', v_count, p_order_id;
    
    RETURN jsonb_build_object(
        'items_voided', v_count,
        'affected_bonus_face_sheet_ids', v_face_sheet_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 ลบ loadlist_items ของ Order
CREATE OR REPLACE FUNCTION remove_order_loadlist_items(
    p_order_id BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_count INT;
    v_loadlist_ids BIGINT[];
BEGIN
    SELECT ARRAY_AGG(DISTINCT loadlist_id) INTO v_loadlist_ids
    FROM loadlist_items
    WHERE order_id = p_order_id;
    
    DELETE FROM loadlist_items
    WHERE order_id = p_order_id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Removed % loadlist items for order %', v_count, p_order_id;
    
    RETURN jsonb_build_object(
        'items_removed', v_count,
        'affected_loadlist_ids', v_loadlist_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Function สำหรับ Remove Order from Route
-- ============================================================================

CREATE OR REPLACE FUNCTION remove_order_from_route(
    p_order_id BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_stop_count INT;
    v_input_count INT;
    v_affected_trip_ids BIGINT[];
    v_affected_plan_ids BIGINT[];
BEGIN
    -- ดึง trip_ids และ plan_ids ที่ได้รับผลกระทบ
    SELECT 
        ARRAY_AGG(DISTINCT trip_id),
        ARRAY_AGG(DISTINCT plan_id)
    INTO v_affected_trip_ids, v_affected_plan_ids
    FROM receiving_route_stops
    WHERE order_id = p_order_id;
    
    -- ลบ route stops
    DELETE FROM receiving_route_stops
    WHERE order_id = p_order_id;
    GET DIAGNOSTICS v_stop_count = ROW_COUNT;
    
    -- ลบ route plan inputs
    DELETE FROM receiving_route_plan_inputs
    WHERE order_id = p_order_id;
    GET DIAGNOSTICS v_input_count = ROW_COUNT;
    
    -- Clear matched_trip_id จาก Order
    UPDATE wms_orders
    SET 
        matched_trip_id = NULL,
        auto_matched_at = NULL,
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    RAISE NOTICE 'Removed order % from route: % stops, % inputs', 
        p_order_id, v_stop_count, v_input_count;
    
    RETURN jsonb_build_object(
        'stops_removed', v_stop_count,
        'inputs_removed', v_input_count,
        'affected_trip_ids', v_affected_trip_ids,
        'affected_plan_ids', v_affected_plan_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Function สำหรับ Void Empty Parent Documents
-- ============================================================================

CREATE OR REPLACE FUNCTION void_empty_parent_documents()
RETURNS JSONB AS $$
DECLARE
    v_picklist_count INT := 0;
    v_face_sheet_count INT := 0;
    v_bonus_face_sheet_count INT := 0;
    v_loadlist_count INT := 0;
    v_rec RECORD;
BEGIN
    -- Void empty picklists
    FOR v_rec IN SELECT * FROM find_empty_picklists() LOOP
        UPDATE picklists SET status = 'voided', updated_at = NOW() WHERE id = v_rec.id;
        v_picklist_count := v_picklist_count + 1;
    END LOOP;
    
    -- Void empty face_sheets
    FOR v_rec IN SELECT * FROM find_empty_face_sheets() LOOP
        UPDATE face_sheets SET status = 'voided', updated_at = NOW() WHERE id = v_rec.id;
        v_face_sheet_count := v_face_sheet_count + 1;
    END LOOP;
    
    -- Void empty bonus_face_sheets
    FOR v_rec IN SELECT * FROM find_empty_bonus_face_sheets() LOOP
        UPDATE bonus_face_sheets SET status = 'voided', updated_at = NOW() WHERE id = v_rec.id;
        v_bonus_face_sheet_count := v_bonus_face_sheet_count + 1;
    END LOOP;
    
    -- Void empty loadlists
    FOR v_rec IN SELECT * FROM find_empty_loadlists() LOOP
        UPDATE loadlists SET status = 'voided', updated_at = NOW() WHERE id = v_rec.id;
        v_loadlist_count := v_loadlist_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'picklists_voided', v_picklist_count,
        'face_sheets_voided', v_face_sheet_count,
        'bonus_face_sheets_voided', v_bonus_face_sheet_count,
        'loadlists_voided', v_loadlist_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Add Comments
-- ============================================================================

COMMENT ON FUNCTION release_reservation IS 'Release reservation และคืน qty กลับไปที่ balance';
COMMENT ON FUNCTION release_order_picklist_reservations IS 'Release ทุก picklist reservations ของ Order';
COMMENT ON FUNCTION release_order_face_sheet_reservations IS 'Release ทุก face sheet reservations ของ Order';
COMMENT ON FUNCTION release_order_bonus_face_sheet_reservations IS 'Release ทุก bonus face sheet reservations ของ Order';
COMMENT ON FUNCTION release_all_order_reservations IS 'Release ALL reservations ของ Order';
COMMENT ON FUNCTION void_order_picklist_items IS 'Void picklist items ของ Order';
COMMENT ON FUNCTION void_order_face_sheet_items IS 'Void face sheet items ของ Order';
COMMENT ON FUNCTION void_order_bonus_face_sheet_items IS 'Void bonus face sheet items ของ Order';
COMMENT ON FUNCTION remove_order_loadlist_items IS 'ลบ loadlist items ของ Order';
COMMENT ON FUNCTION remove_order_from_route IS 'ลบ Order ออกจาก Route';
COMMENT ON FUNCTION void_empty_parent_documents IS 'Void parent documents ที่ไม่มี active items';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 159 completed: release reservation functions created';
END $$;

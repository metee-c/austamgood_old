-- ============================================================================
-- Migration: Create Release All Order Reservations Function
-- Description: Function สำหรับปล่อยการจองสต็อกทั้งหมดของ Order
-- ============================================================================

-- Function: Release All Order Reservations
CREATE OR REPLACE FUNCTION release_all_order_reservations(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_picklist_released INT := 0;
  v_face_sheet_released INT := 0;
  v_bonus_released INT := 0;
  v_total_released INT := 0;
  v_picklist_item_ids BIGINT[];
  v_face_sheet_item_ids BIGINT[];
  v_bonus_item_ids BIGINT[];
  v_order_item_ids BIGINT[];
  rec RECORD;
BEGIN
  -- ========================================
  -- 1. Release Picklist Item Reservations
  -- ========================================
  
  -- Get picklist_item_ids for this order
  SELECT ARRAY_AGG(id)
  INTO v_picklist_item_ids
  FROM picklist_items
  WHERE order_id = p_order_id;

  IF v_picklist_item_ids IS NOT NULL AND array_length(v_picklist_item_ids, 1) > 0 THEN
    -- Release reserved qty back to balance
    FOR rec IN 
      SELECT pir.reservation_id, pir.balance_id, pir.reserved_piece_qty, pir.reserved_pack_qty
      FROM picklist_item_reservations pir
      WHERE pir.picklist_item_id = ANY(v_picklist_item_ids)
        AND pir.status = 'reserved'
    LOOP
      -- Update balance
      UPDATE wms_inventory_balances
      SET 
        reserved_piece_qty = GREATEST(0, reserved_piece_qty - rec.reserved_piece_qty),
        reserved_pack_qty = GREATEST(0, reserved_pack_qty - rec.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = rec.balance_id;

      v_picklist_released := v_picklist_released + 1;
    END LOOP;

    -- Update reservation status
    UPDATE picklist_item_reservations
    SET 
      status = 'released',
      updated_at = NOW()
    WHERE picklist_item_id = ANY(v_picklist_item_ids)
      AND status = 'reserved';
  END IF;

  -- ========================================
  -- 2. Release Face Sheet Item Reservations
  -- ========================================
  
  -- Get face_sheet_item_ids for this order
  SELECT ARRAY_AGG(id)
  INTO v_face_sheet_item_ids
  FROM face_sheet_items
  WHERE order_id = p_order_id;

  IF v_face_sheet_item_ids IS NOT NULL AND array_length(v_face_sheet_item_ids, 1) > 0 THEN
    -- Release reserved qty back to balance
    FOR rec IN 
      SELECT fsir.reservation_id, fsir.balance_id, fsir.reserved_piece_qty, fsir.reserved_pack_qty
      FROM face_sheet_item_reservations fsir
      WHERE fsir.face_sheet_item_id = ANY(v_face_sheet_item_ids)
        AND fsir.status = 'reserved'
    LOOP
      -- Update balance
      UPDATE wms_inventory_balances
      SET 
        reserved_piece_qty = GREATEST(0, reserved_piece_qty - rec.reserved_piece_qty),
        reserved_pack_qty = GREATEST(0, reserved_pack_qty - rec.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = rec.balance_id;

      v_face_sheet_released := v_face_sheet_released + 1;
    END LOOP;

    -- Update reservation status
    UPDATE face_sheet_item_reservations
    SET 
      status = 'released',
      updated_at = NOW()
    WHERE face_sheet_item_id = ANY(v_face_sheet_item_ids)
      AND status = 'reserved';
  END IF;

  -- ========================================
  -- 3. Release Bonus Face Sheet Item Reservations
  -- ========================================
  
  -- Get order_item_ids for this order
  SELECT ARRAY_AGG(order_item_id)
  INTO v_order_item_ids
  FROM wms_order_items
  WHERE order_id = p_order_id;

  IF v_order_item_ids IS NOT NULL AND array_length(v_order_item_ids, 1) > 0 THEN
    -- Get bonus_face_sheet_item_ids
    SELECT ARRAY_AGG(id)
    INTO v_bonus_item_ids
    FROM bonus_face_sheet_items
    WHERE order_item_id = ANY(v_order_item_ids);

    IF v_bonus_item_ids IS NOT NULL AND array_length(v_bonus_item_ids, 1) > 0 THEN
      -- Release reserved qty back to balance
      FOR rec IN 
        SELECT bfsir.reservation_id, bfsir.balance_id, bfsir.reserved_piece_qty, bfsir.reserved_pack_qty
        FROM bonus_face_sheet_item_reservations bfsir
        WHERE bfsir.bonus_face_sheet_item_id = ANY(v_bonus_item_ids)
          AND bfsir.status = 'reserved'
      LOOP
        -- Update balance
        UPDATE wms_inventory_balances
        SET 
          reserved_piece_qty = GREATEST(0, reserved_piece_qty - rec.reserved_piece_qty),
          reserved_pack_qty = GREATEST(0, reserved_pack_qty - rec.reserved_pack_qty),
          updated_at = NOW()
        WHERE balance_id = rec.balance_id;

        v_bonus_released := v_bonus_released + 1;
      END LOOP;

      -- Update reservation status
      UPDATE bonus_face_sheet_item_reservations
      SET 
        status = 'released',
        updated_at = NOW()
      WHERE bonus_face_sheet_item_id = ANY(v_bonus_item_ids)
        AND status = 'reserved';
    END IF;
  END IF;

  v_total_released := v_picklist_released + v_face_sheet_released + v_bonus_released;

  RETURN jsonb_build_object(
    'total_released', v_total_released,
    'picklist_reservations_released', v_picklist_released,
    'face_sheet_reservations_released', v_face_sheet_released,
    'bonus_reservations_released', v_bonus_released
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_all_order_reservations IS 'ปล่อยการจองสต็อกทั้งหมดของ Order';

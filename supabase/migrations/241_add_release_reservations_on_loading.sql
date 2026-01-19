-- Migration 241: Add function to release reservations when loading is confirmed
-- 
-- Problem: When loading is confirmed, the API deducts stock but does NOT release reservations
--          This causes constraint violation: reserved_piece_qty > total_piece_qty
--
-- Solution: Create a function to release all reservations for a loadlist
--           Change status from 'picked' to 'loaded' AND decrement reserved_piece_qty in balance table

-- Function to release a single reservation (helper function)
CREATE OR REPLACE FUNCTION release_single_reservation(
  p_balance_id BIGINT,
  p_reserved_piece_qty NUMERIC,
  p_reserved_pack_qty NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_current_reserved_piece NUMERIC;
  v_current_reserved_pack NUMERIC;
  v_new_reserved_piece NUMERIC;
  v_new_reserved_pack NUMERIC;
BEGIN
  -- Get current reserved quantities
  SELECT reserved_piece_qty, reserved_pack_qty 
  INTO v_current_reserved_piece, v_current_reserved_pack
  FROM wms_inventory_balances
  WHERE balance_id = p_balance_id;

  -- Calculate new reserved quantities (cannot go below 0)
  v_new_reserved_piece := GREATEST(0, v_current_reserved_piece - p_reserved_piece_qty);
  v_new_reserved_pack := GREATEST(0, v_current_reserved_pack - p_reserved_pack_qty);

  -- Update balance
  UPDATE wms_inventory_balances
  SET 
    reserved_piece_qty = v_new_reserved_piece,
    reserved_pack_qty = v_new_reserved_pack,
    updated_at = NOW()
  WHERE balance_id = p_balance_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release reservations for a loadlist
CREATE OR REPLACE FUNCTION release_loadlist_reservations(
  p_loadlist_id INTEGER
)
RETURNS TABLE (
  released_count INTEGER,
  total_reserved_qty NUMERIC
) AS $$
DECLARE
  v_released_count INTEGER := 0;
  v_total_reserved_qty NUMERIC := 0;
  v_reservation RECORD;
BEGIN
  -- Loop through all picklist reservations and release them
  FOR v_reservation IN (
    SELECT 
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty
    FROM wms_loadlist_picklists lp
    JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    WHERE lp.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND r.staging_location_id = 'Dispatch'
      AND pi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    -- Release the reservation (decrement balance reserved qty)
    PERFORM release_single_reservation(
      v_reservation.balance_id,
      v_reservation.reserved_piece_qty,
      v_reservation.reserved_pack_qty
    );
    
    -- Update reservation status to 'loaded'
    UPDATE picklist_item_reservations
    SET 
      status = 'loaded',
      updated_at = NOW()
    WHERE reservation_id = v_reservation.reservation_id;
    
    v_released_count := v_released_count + 1;
    v_total_reserved_qty := v_total_reserved_qty + v_reservation.reserved_piece_qty;
  END LOOP;
  
  RETURN QUERY SELECT v_released_count, v_total_reserved_qty;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_loadlist_reservations IS 
'Release all picklist reservations for a loadlist by changing status from picked to loaded and decrementing balance reserved quantities';

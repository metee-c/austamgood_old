-- Migration 242: Fix release_loadlist_reservations to use BIGINT for loadlist_id
-- 
-- Problem: Function uses INTEGER but loadlist.id is BIGINT, causing type mismatch
-- Solution: Drop and recreate function with BIGINT parameter

-- Drop existing function
DROP FUNCTION IF EXISTS release_loadlist_reservations(INTEGER);

-- Recreate with BIGINT parameter
CREATE OR REPLACE FUNCTION release_loadlist_reservations(
  p_loadlist_id BIGINT
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
    -- Decrement balance reserved quantities
    UPDATE wms_inventory_balances
    SET 
      reserved_piece_qty = GREATEST(0, reserved_piece_qty - v_reservation.reserved_piece_qty),
      reserved_pack_qty = GREATEST(0, reserved_pack_qty - v_reservation.reserved_pack_qty),
      updated_at = NOW()
    WHERE balance_id = v_reservation.balance_id;
    
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
'Release all picklist reservations for a loadlist by changing status from picked to loaded and decrementing balance reserved quantities. Uses BIGINT for loadlist_id.';

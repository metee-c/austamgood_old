-- Migration 243: Fix loading complete to deduct from correct balance
-- 
-- Problem: API deducts from wrong balance_id
--   - Reservations are at balance_id from source location (e.g., PK001)
--   - But API queries Dispatch and gets first row (wrong balance_id)
--   - Function releases reservation correctly, but API deducts from wrong balance
--   - Result: Constraint violation (reserved > total)
--
-- Solution: Create function that handles BOTH release AND deduct in one transaction
--   - Ensures we deduct from the same balance that has the reservation
--   - Atomic operation prevents partial updates

-- Drop existing function
DROP FUNCTION IF EXISTS release_loadlist_reservations(BIGINT);

-- Create new function that releases reservations AND deducts stock
CREATE OR REPLACE FUNCTION process_loadlist_loading_complete(
  p_loadlist_id BIGINT,
  p_delivery_location_id VARCHAR
)
RETURNS TABLE (
  processed_count INTEGER,
  total_qty_moved NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_total_qty_moved NUMERIC := 0;
  v_reservation RECORD;
  v_new_balance_id BIGINT;
  v_error_msg TEXT := NULL;
BEGIN
  -- Loop through all picklist reservations
  FOR v_reservation IN (
    SELECT 
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty,
      pi.sku_id,
      pi.picklist_id,
      b.warehouse_id,
      b.location_id as source_location_id,
      b.pallet_id,
      b.production_date,
      b.expiry_date,
      b.lot_no,
      b.total_piece_qty,
      b.total_pack_qty,
      b.reserved_piece_qty as current_reserved_piece,
      b.reserved_pack_qty as current_reserved_pack,
      p.picklist_code
    FROM wms_loadlist_picklists lp
    JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    JOIN wms_inventory_balances b ON b.balance_id = r.balance_id
    JOIN picklists p ON p.id = pi.picklist_id
    WHERE lp.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND r.staging_location_id = 'Dispatch'
      AND pi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    BEGIN
      -- 1. Decrement reserved quantities in source balance
      UPDATE wms_inventory_balances
      SET 
        reserved_piece_qty = GREATEST(0, reserved_piece_qty - v_reservation.reserved_piece_qty),
        reserved_pack_qty = GREATEST(0, reserved_pack_qty - v_reservation.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;
      
      -- 2. Deduct total quantities from source balance
      UPDATE wms_inventory_balances
      SET 
        total_piece_qty = GREATEST(0, total_piece_qty - v_reservation.reserved_piece_qty),
        total_pack_qty = GREATEST(0, total_pack_qty - v_reservation.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;
      
      -- 3. Add to delivery location (Delivery-In-Progress)
      -- Check if balance exists for this SKU + pallet + dates at delivery location
      SELECT balance_id INTO v_new_balance_id
      FROM wms_inventory_balances
      WHERE warehouse_id = v_reservation.warehouse_id
        AND location_id = p_delivery_location_id
        AND sku_id = v_reservation.sku_id
        AND COALESCE(pallet_id, '') = COALESCE(v_reservation.pallet_id, '')
        AND COALESCE(production_date::TEXT, '') = COALESCE(v_reservation.production_date::TEXT, '')
        AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_reservation.expiry_date::TEXT, '')
        AND COALESCE(lot_no, '') = COALESCE(v_reservation.lot_no, '')
      LIMIT 1;
      
      IF v_new_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET 
          total_piece_qty = total_piece_qty + v_reservation.reserved_piece_qty,
          total_pack_qty = total_pack_qty + v_reservation.reserved_pack_qty,
          updated_at = NOW()
        WHERE balance_id = v_new_balance_id;
      ELSE
        -- Create new balance
        INSERT INTO wms_inventory_balances (
          warehouse_id, location_id, sku_id, pallet_id,
          production_date, expiry_date, lot_no,
          total_piece_qty, total_pack_qty,
          reserved_piece_qty, reserved_pack_qty,
          created_at, updated_at
        ) VALUES (
          v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id, v_reservation.pallet_id,
          v_reservation.production_date, v_reservation.expiry_date, v_reservation.lot_no,
          v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
          0, 0,
          NOW(), NOW()
        )
        RETURNING balance_id INTO v_new_balance_id;
      END IF;
      
      -- 4. Create ledger entries (OUT from source, IN to delivery)
      -- OUT entry
      INSERT INTO wms_inventory_ledger (
        transaction_type, reference_no, warehouse_id, location_id, sku_id,
        pallet_id, production_date, expiry_date,
        direction, piece_qty, pack_qty, remarks,
        skip_balance_sync, created_at
      ) VALUES (
        'ship', 'LD-' || p_loadlist_id, v_reservation.warehouse_id, v_reservation.source_location_id, v_reservation.sku_id,
        v_reservation.pallet_id, v_reservation.production_date, v_reservation.expiry_date,
        'out', v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
        'Loading complete: ' || v_reservation.picklist_code,
        true, NOW()
      );
      
      -- IN entry
      INSERT INTO wms_inventory_ledger (
        transaction_type, reference_no, warehouse_id, location_id, sku_id,
        pallet_id, production_date, expiry_date,
        direction, piece_qty, pack_qty, remarks,
        skip_balance_sync, created_at
      ) VALUES (
        'ship', 'LD-' || p_loadlist_id, v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id,
        v_reservation.pallet_id, v_reservation.production_date, v_reservation.expiry_date,
        'in', v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
        'Loading complete: ' || v_reservation.picklist_code,
        true, NOW()
      );
      
      -- 5. Update reservation status to 'loaded'
      UPDATE picklist_item_reservations
      SET 
        status = 'loaded',
        updated_at = NOW()
      WHERE reservation_id = v_reservation.reservation_id;
      
      v_processed_count := v_processed_count + 1;
      v_total_qty_moved := v_total_qty_moved + v_reservation.reserved_piece_qty;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      RAISE NOTICE 'Error processing reservation %: %', v_reservation.reservation_id, v_error_msg;
      -- Continue to next reservation instead of failing entire transaction
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_processed_count, v_total_qty_moved, v_error_msg;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_loadlist_loading_complete IS 
'Process loading complete: release reservations, deduct from source balance, add to delivery location, create ledger entries. Ensures we deduct from the correct balance that has the reservation.';

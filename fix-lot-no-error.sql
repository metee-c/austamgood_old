-- Fix lot_no field error in trigger
-- Problem: wms_inventory_ledger doesn't have lot_no field

CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_id BIGINT;
  v_lookup_pallet_id TEXT;
  v_current_pack_qty INTEGER;
  v_current_piece_qty INTEGER;
BEGIN
  -- Check skip_balance_sync flag
  IF NEW.skip_balance_sync = TRUE THEN
    RETURN NEW;
  END IF;

  -- Use pallet_id or pallet_id_external
  v_lookup_pallet_id := COALESCE(NEW.pallet_id, NEW.pallet_id_external, '');

  -- Calculate the signed quantity based on direction
  IF NEW.direction = 'in' THEN
    v_current_pack_qty := NEW.pack_qty;
    v_current_piece_qty := NEW.piece_qty;
  ELSE -- direction = 'out'
    v_current_pack_qty := -NEW.pack_qty;
    v_current_piece_qty := -NEW.piece_qty;
  END IF;

  -- Check if balance record exists (removed lot_no reference)
  SELECT balance_id INTO v_balance_id
  FROM wms_inventory_balances
  WHERE warehouse_id = NEW.warehouse_id
    AND location_id = NEW.location_id
    AND sku_id = NEW.sku_id
    AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(NEW.production_date, '1900-01-01'::date)
    AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(NEW.expiry_date, '1900-01-01'::date)
    AND COALESCE(pallet_id, '') = v_lookup_pallet_id;

  IF v_balance_id IS NOT NULL THEN
    -- Update existing balance
    UPDATE wms_inventory_balances
    SET
        total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
        total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
        last_movement_at = NEW.movement_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_balance_id;
  ELSE
    -- Insert new balance record (only if direction is 'in')
    IF NEW.direction = 'in' THEN
      INSERT INTO wms_inventory_balances (
        warehouse_id, location_id, sku_id, pallet_id, pallet_id_external,
        production_date, expiry_date, total_pack_qty, total_piece_qty,
        reserved_pack_qty, reserved_piece_qty, last_movement_at,
        created_at, updated_at
      ) VALUES (
        NEW.warehouse_id, NEW.location_id, NEW.sku_id, NEW.pallet_id, NEW.pallet_id_external,
        NEW.production_date, NEW.expiry_date, NEW.pack_qty, NEW.piece_qty,
        0, 0, NEW.movement_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_inventory_ledger_to_balance ON wms_inventory_ledger;
CREATE TRIGGER trigger_sync_inventory_ledger_to_balance
  AFTER INSERT ON wms_inventory_ledger
  FOR EACH ROW
  WHEN (NEW.skip_balance_sync IS NOT TRUE)
  EXECUTE FUNCTION sync_inventory_ledger_to_balance();

-- Fix preparation_area_id error in trigger
-- Problem: master_location doesn't have preparation_area_id column

CREATE OR REPLACE FUNCTION sync_balance_to_prep_area_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_prep_area_code VARCHAR(50);
  v_prep_area_id UUID;
  v_available_pack_qty INTEGER;
  v_available_piece_qty INTEGER;
BEGIN
  -- Check if this location belongs to a preparation area by checking preparation_area table
  SELECT area_code, area_id INTO v_prep_area_code, v_prep_area_id
  FROM preparation_area
  WHERE area_code = NEW.location_id AND status = 'active';

  -- If not a prep area location, skip
  IF v_prep_area_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate available quantities
  v_available_pack_qty := GREATEST(0, NEW.total_pack_qty - NEW.reserved_pack_qty);
  v_available_piece_qty := GREATEST(0, NEW.total_piece_qty - NEW.reserved_piece_qty);

  -- Upsert into preparation_area_inventory
  INSERT INTO preparation_area_inventory (
    preparation_area_id,
    preparation_area_code,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date,
    available_pack_qty,
    available_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    created_at,
    updated_at
  ) VALUES (
    v_prep_area_id,
    v_prep_area_code,
    NEW.sku_id,
    NEW.pallet_id,
    NEW.pallet_id_external,
    NEW.production_date,
    NEW.expiry_date,
    v_available_pack_qty,
    v_available_piece_qty,
    NEW.reserved_pack_qty,
    NEW.reserved_piece_qty,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (preparation_area_id, sku_id, pallet_id, production_date, expiry_date)
  DO UPDATE SET
    available_pack_qty = EXCLUDED.available_pack_qty,
    available_piece_qty = EXCLUDED.available_piece_qty,
    reserved_pack_qty = EXCLUDED.reserved_pack_qty,
    reserved_piece_qty = EXCLUDED.reserved_piece_qty,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_balance_to_prep_area_inventory ON wms_inventory_balances;
CREATE TRIGGER trigger_sync_balance_to_prep_area_inventory
  AFTER INSERT OR UPDATE ON wms_inventory_balances
  FOR EACH ROW
  EXECUTE FUNCTION sync_balance_to_prep_area_inventory();

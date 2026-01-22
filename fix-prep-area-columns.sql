-- Fix column names in preparation_area_inventory trigger
-- Problem: preparation_area_inventory uses latest_pallet_id not pallet_id

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

  -- Upsert into preparation_area_inventory with correct column names
  INSERT INTO preparation_area_inventory (
    warehouse_id,
    preparation_area_id,
    preparation_area_code,
    sku_id,
    latest_pallet_id,
    latest_pallet_id_external,
    latest_production_date,
    latest_expiry_date,
    available_pack_qty,
    available_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    total_pack_qty,
    total_piece_qty,
    last_movement_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.warehouse_id,
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
    NEW.total_pack_qty,
    NEW.total_piece_qty,
    NEW.last_movement_at,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (warehouse_id, preparation_area_code, sku_id)
  DO UPDATE SET
    latest_pallet_id = EXCLUDED.latest_pallet_id,
    latest_pallet_id_external = EXCLUDED.latest_pallet_id_external,
    latest_production_date = EXCLUDED.latest_production_date,
    latest_expiry_date = EXCLUDED.latest_expiry_date,
    available_pack_qty = EXCLUDED.available_pack_qty,
    available_piece_qty = EXCLUDED.available_piece_qty,
    reserved_pack_qty = EXCLUDED.reserved_pack_qty,
    reserved_piece_qty = EXCLUDED.reserved_piece_qty,
    total_pack_qty = EXCLUDED.total_pack_qty,
    total_piece_qty = EXCLUDED.total_piece_qty,
    last_movement_at = EXCLUDED.last_movement_at,
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

-- Migration 292: Fix lot_no references in triggers
-- Problem: Triggers reference NEW.lot_no but wms_inventory_ledger doesn't have lot_no column
-- Solution: Remove lot_no references since we use expiry_date instead

-- ============================================================================
-- Fix sync_inventory_ledger_to_balance trigger (from migration 291)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_id UUID;
  v_lookup_pallet_id TEXT;
  v_delta_pack_qty INTEGER;
  v_delta_piece_qty INTEGER;
BEGIN
  -- ✅ ใช้ pallet_id หรือ pallet_id_external (ตามลำดับความสำคัญ)
  v_lookup_pallet_id := COALESCE(NEW.pallet_id, NEW.pallet_id_external, '');

  -- Calculate delta based on direction
  IF NEW.direction = 'in' THEN
    v_delta_pack_qty := NEW.pack_qty;
    v_delta_piece_qty := NEW.piece_qty;
  ELSE
    v_delta_pack_qty := -NEW.pack_qty;
    v_delta_piece_qty := -NEW.piece_qty;
  END IF;

  -- Try to find existing balance record
  SELECT balance_id INTO v_balance_id
  FROM wms_inventory_balances
  WHERE warehouse_id = NEW.warehouse_id
    AND location_id = NEW.location_id
    AND sku_id = NEW.sku_id
    AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(NEW.production_date, '1900-01-01'::date)
    AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(NEW.expiry_date, '1900-01-01'::date)
    -- ✅ ลบการเช็ค lot_no ออก เพราะไม่มีคอลัมน์นี้ใน wms_inventory_ledger
    AND COALESCE(pallet_id, '') = v_lookup_pallet_id;

  IF v_balance_id IS NOT NULL THEN
    -- Update existing balance
    UPDATE wms_inventory_balances
    SET 
      total_pack_qty = total_pack_qty + v_delta_pack_qty,
      total_piece_qty = total_piece_qty + v_delta_piece_qty,
      updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_balance_id;

    RAISE NOTICE 'Updated balance_id: %, pallet: %, delta: pack=%, piece=%', 
      v_balance_id, v_lookup_pallet_id, v_delta_pack_qty, v_delta_piece_qty;
  ELSE
    -- Create new balance record (only for IN movements)
    IF NEW.direction = 'in' THEN
      INSERT INTO wms_inventory_balances (
        warehouse_id,
        location_id,
        sku_id,
        production_date,
        expiry_date,
        pallet_id,
        pallet_id_external,
        total_pack_qty,
        total_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        created_at,
        updated_at
      ) VALUES (
        NEW.warehouse_id,
        NEW.location_id,
        NEW.sku_id,
        NEW.production_date,
        NEW.expiry_date,
        NEW.pallet_id,
        NEW.pallet_id_external,
        NEW.pack_qty,
        NEW.piece_qty,
        0,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );

      RAISE NOTICE 'Created new balance for pallet: %, pack: %, piece: %', 
        v_lookup_pallet_id, NEW.pack_qty, NEW.piece_qty;
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

-- ============================================================================
-- Fix sync_balance_to_prep_area_inventory trigger (from migration 280)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_balance_to_prep_area_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_prep_area_id UUID;
  v_available_pack_qty INTEGER;
  v_available_piece_qty INTEGER;
BEGIN
  -- Check if this location belongs to a preparation area
  SELECT preparation_area_id INTO v_prep_area_id
  FROM master_location
  WHERE location_id = NEW.location_id;

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
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date,
    -- ✅ ลบ lot_no ออก เพราะไม่มีคอลัมน์นี้
    available_pack_qty,
    available_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    created_at,
    updated_at
  ) VALUES (
    v_prep_area_id,
    NEW.sku_id,
    NEW.pallet_id,
    NEW.pallet_id_external,
    NEW.production_date,
    NEW.expiry_date,
    -- ✅ ลบ lot_no ออก
    v_available_pack_qty,
    v_available_piece_qty,
    NEW.reserved_pack_qty,
    NEW.reserved_piece_qty,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (
    preparation_area_id,
    sku_id,
    COALESCE(pallet_id, ''),
    COALESCE(pallet_id_external, ''),
    -- ✅ ลบ lot_no ออกจาก unique constraint check
    COALESCE(production_date::TEXT, ''),
    COALESCE(expiry_date::TEXT, '')
  )
  DO UPDATE SET
    available_pack_qty = v_available_pack_qty,
    available_piece_qty = v_available_piece_qty,
    reserved_pack_qty = NEW.reserved_pack_qty,
    reserved_piece_qty = NEW.reserved_piece_qty,
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

-- Add comments
COMMENT ON FUNCTION sync_inventory_ledger_to_balance() IS 
'Migration 292: Fixed to remove lot_no references since wms_inventory_ledger uses expiry_date instead';

COMMENT ON FUNCTION sync_balance_to_prep_area_inventory() IS 
'Migration 292: Fixed to remove lot_no references since wms_inventory_balances uses expiry_date instead';

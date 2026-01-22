-- Migration: Fix sync_move_item_to_ledger trigger to use correct warehouse_id column
-- Description: The wms_moves table doesn't have warehouse_id, it has from_warehouse_id and to_warehouse_id
-- Date: 2026-01-22

-- Update function to use from_warehouse_id instead of warehouse_id
CREATE OR REPLACE FUNCTION sync_move_item_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id TEXT;
  v_sku_id TEXT;
  v_pallet_id TEXT;
  v_production_date DATE;
  v_expiry_date DATE;
  v_reference_no TEXT;
BEGIN
  -- Only process if status is 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get warehouse_id from the move header (use from_warehouse_id, fallback to 'WH001')
  SELECT COALESCE(from_warehouse_id, 'WH001') INTO v_warehouse_id
  FROM wms_moves
  WHERE move_id = NEW.move_id;

  -- Get SKU and pallet details from the move item itself
  v_sku_id := NEW.sku_id;
  v_pallet_id := NEW.pallet_id;
  v_production_date := NEW.production_date;
  v_expiry_date := NEW.expiry_date;

  -- Skip if no SKU (shouldn't happen but safety check)
  IF v_sku_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get reference number from move header
  SELECT move_no INTO v_reference_no
  FROM wms_moves
  WHERE move_id = NEW.move_id;

  -- Create OUT ledger entry (from source location)
  INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    move_item_id,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    reference_no,
    created_by,
    skip_balance_sync
  ) VALUES (
    COALESCE(NEW.completed_at, NOW()),
    'move',
    'out',
    NEW.move_item_id,
    v_warehouse_id,
    NEW.from_location_id,
    v_sku_id,
    v_pallet_id,
    v_production_date,
    v_expiry_date,
    NEW.confirmed_pack_qty,
    NEW.confirmed_piece_qty,
    v_reference_no,
    NEW.created_by,
    false  -- Let the balance sync trigger handle balance updates
  );

  -- Create IN ledger entry (to destination location)
  INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    move_item_id,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    reference_no,
    created_by,
    skip_balance_sync
  ) VALUES (
    COALESCE(NEW.completed_at, NOW()),
    'move',
    'in',
    NEW.move_item_id,
    v_warehouse_id,
    NEW.to_location_id,
    v_sku_id,
    v_pallet_id,
    v_production_date,
    v_expiry_date,
    NEW.confirmed_pack_qty,
    NEW.confirmed_piece_qty,
    v_reference_no,
    NEW.created_by,
    false  -- Let the balance sync trigger handle balance updates
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION sync_move_item_to_ledger() IS 'Automatically creates inventory ledger entries (IN and OUT) when move items are completed. Fixed to use from_warehouse_id instead of non-existent warehouse_id column.';

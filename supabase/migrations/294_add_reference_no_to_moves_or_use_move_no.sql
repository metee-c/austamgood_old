-- Migration 294: Use move_no as reference_no in sync_move_item_to_ledger trigger
-- The wms_moves table doesn't have reference_no column, so we'll use move_no instead

-- Drop and recreate the trigger function to use move_no
CREATE OR REPLACE FUNCTION sync_move_item_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id TEXT;
  v_sku_id TEXT;
  v_pallet_id TEXT;
  v_production_date DATE;
  v_expiry_date DATE;
  v_move_no TEXT;
BEGIN
  -- Only process if status is 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- ✅ Get from_warehouse_id and move_no from the move header
  SELECT from_warehouse_id, move_no 
  INTO v_warehouse_id, v_move_no
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
    v_move_no,  -- Use move_no as reference
    NEW.created_by,
    false -- Let the balance sync trigger handle balance updates
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
    v_move_no,  -- Use move_no as reference
    NEW.created_by,
    false -- Let the balance sync trigger handle balance updates
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION sync_move_item_to_ledger() IS 'Migration 294: Fixed to use move_no as reference_no since wms_moves table does not have reference_no column';

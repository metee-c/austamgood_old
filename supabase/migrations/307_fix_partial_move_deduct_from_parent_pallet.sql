-- Migration 307: Fix partial move to deduct from parent_pallet_id
-- Problem: When doing partial pallet move (split), the trigger creates OUT ledger with new_pallet_id
--          but the stock is actually at parent_pallet_id, so balance doesn't get deducted
-- Solution: For OUT ledger entry, use parent_pallet_id if it exists

CREATE OR REPLACE FUNCTION sync_move_item_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id TEXT;
  v_sku_id TEXT;
  v_pallet_id TEXT;
  v_source_pallet_id TEXT;
  v_production_date DATE;
  v_expiry_date DATE;
  v_move_no TEXT;
BEGIN
  -- Only process if status is 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get from_warehouse_id and move_no from the move header
  SELECT from_warehouse_id, move_no 
  INTO v_warehouse_id, v_move_no
  FROM wms_moves 
  WHERE move_id = NEW.move_id;

  -- Get SKU and pallet details from the move item itself
  v_sku_id := NEW.sku_id;
  v_pallet_id := NEW.pallet_id;
  v_production_date := NEW.production_date;
  v_expiry_date := NEW.expiry_date;

  -- ✅ FIX: For partial pallet moves, use parent_pallet_id for source deduction
  v_source_pallet_id := COALESCE(NEW.parent_pallet_id, NEW.pallet_id);

  -- Skip if no SKU (shouldn't happen but safety check)
  IF v_sku_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If production_date or expiry_date is NULL, try to fetch from source balance
  IF v_production_date IS NULL OR v_expiry_date IS NULL THEN
    SELECT 
      COALESCE(v_production_date, production_date),
      COALESCE(v_expiry_date, expiry_date)
    INTO v_production_date, v_expiry_date
    FROM wms_inventory_balances
    WHERE warehouse_id = v_warehouse_id
      AND location_id = NEW.from_location_id
      AND sku_id = v_sku_id
      AND (
        (v_source_pallet_id IS NULL AND pallet_id IS NULL) OR
        (pallet_id = v_source_pallet_id)
      )
    LIMIT 1;
  END IF;

  -- ✅ FIX: Create OUT ledger entry using SOURCE pallet (parent_pallet_id if partial move)
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
    v_source_pallet_id,  -- ✅ Use parent_pallet_id for OUT (source deduction)
    v_production_date,
    v_expiry_date,
    NEW.confirmed_pack_qty,
    NEW.confirmed_piece_qty,
    v_move_no,
    NEW.created_by,
    false
  );

  -- Create IN ledger entry (to destination location) - use new pallet_id
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
    v_pallet_id,  -- Use new pallet_id for IN (destination)
    v_production_date,
    v_expiry_date,
    NEW.confirmed_pack_qty,
    NEW.confirmed_piece_qty,
    v_move_no,
    NEW.created_by,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_move_item_to_ledger() IS 'Fixed to use parent_pallet_id for OUT ledger entry when doing partial pallet move (split). This ensures stock is deducted from the correct source pallet.';

-- Migration 303: Fix sync_move_item_to_ledger to fetch production_date/expiry_date from source balance
-- Problem: When move_item doesn't have production_date/expiry_date, the trigger creates ledger entries with NULL dates
-- Solution: Fetch dates from source balance (wms_inventory_balances) when move_item dates are NULL
-- Also removed duplicate recordInventoryMovement() call from /api/moves/items/[id]/route.ts

CREATE OR REPLACE FUNCTION sync_move_item_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id TEXT;
  v_sku_id TEXT;
  v_pallet_id TEXT;
  v_production_date DATE;
  v_expiry_date DATE;
  v_move_no TEXT;
  v_source_pallet_id TEXT;
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

  -- Skip if no SKU (shouldn't happen but safety check)
  IF v_sku_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If production_date or expiry_date is NULL, try to fetch from source balance
  IF v_production_date IS NULL OR v_expiry_date IS NULL THEN
    -- For partial pallet moves, use parent_pallet_id to find source balance
    v_source_pallet_id := COALESCE(NEW.parent_pallet_id, NEW.pallet_id);
    
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
    v_move_no,
    NEW.created_by,
    false
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
    v_move_no,
    NEW.created_by,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_move_item_to_ledger() IS 'Fixed to fetch production_date/expiry_date from source balance when move_item dates are NULL. Prevents duplicate ledger entries issue.';

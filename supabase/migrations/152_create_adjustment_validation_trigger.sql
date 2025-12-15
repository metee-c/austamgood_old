-- Migration: 152_create_adjustment_validation_trigger.sql
-- Purpose: Create validation trigger to prevent adjusting reserved stock
-- Date: 2025-12-15
-- Author: System Auditor

-- Step 1: Create validation function for reserved stock
CREATE OR REPLACE FUNCTION validate_adjustment_reserved_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_adjustment_type VARCHAR(20);
  v_warehouse_id VARCHAR(50);
  v_balance_record RECORD;
  v_total_qty INTEGER;
  v_reserved_qty INTEGER;
  v_available_qty INTEGER;
  v_adjustment_abs INTEGER;
BEGIN
  -- Get adjustment type and warehouse from header
  SELECT adjustment_type, warehouse_id
  INTO v_adjustment_type, v_warehouse_id
  FROM wms_stock_adjustments
  WHERE adjustment_id = NEW.adjustment_id;

  -- Only validate for decrease adjustments
  IF v_adjustment_type = 'decrease' THEN
    -- Get absolute value of adjustment quantity
    v_adjustment_abs := ABS(NEW.adjustment_piece_qty);

    -- Query balance record
    SELECT
      COALESCE(total_piece_qty, 0) as total_qty,
      COALESCE(reserved_piece_qty, 0) as reserved_qty
    INTO v_balance_record
    FROM wms_inventory_balances
    WHERE warehouse_id = v_warehouse_id
      AND location_id = NEW.location_id
      AND sku_id = NEW.sku_id
      AND (
        (pallet_id IS NULL AND NEW.pallet_id IS NULL) OR
        (pallet_id = NEW.pallet_id)
      )
      AND (
        (pallet_id_external IS NULL AND NEW.pallet_id_external IS NULL) OR
        (pallet_id_external = NEW.pallet_id_external)
      );

    -- If no balance record found, check if adjustment quantity is valid
    IF NOT FOUND THEN
      -- No existing balance, so cannot decrease
      RAISE EXCEPTION 'Cannot decrease stock: No inventory balance found for SKU "%" at location "%". Current balance: 0 pieces.',
        NEW.sku_id, NEW.location_id
        USING HINT = 'Ensure the SKU exists at this location before attempting to decrease stock.';
    END IF;

    -- Extract values
    v_total_qty := v_balance_record.total_qty;
    v_reserved_qty := v_balance_record.reserved_qty;
    v_available_qty := v_total_qty - v_reserved_qty;

    -- Validate: adjustment cannot exceed available quantity
    IF v_adjustment_abs > v_available_qty THEN
      RAISE EXCEPTION 'Cannot decrease stock: Adjustment quantity (% pieces) exceeds available quantity (% pieces). Total: % pieces, Reserved: % pieces. Location: %, SKU: %, Pallet: %',
        v_adjustment_abs,
        v_available_qty,
        v_total_qty,
        v_reserved_qty,
        NEW.location_id,
        NEW.sku_id,
        COALESCE(NEW.pallet_id, 'N/A')
        USING HINT = 'Cannot adjust stock that is reserved for orders. Unreserve stock first or reduce adjustment quantity.';
    END IF;

    -- Additional check: ensure total quantity is sufficient
    IF v_adjustment_abs > v_total_qty THEN
      RAISE EXCEPTION 'Cannot decrease stock: Adjustment quantity (% pieces) exceeds total quantity (% pieces). Location: %, SKU: %, Pallet: %',
        v_adjustment_abs,
        v_total_qty,
        NEW.location_id,
        NEW.sku_id,
        COALESCE(NEW.pallet_id, 'N/A')
        USING HINT = 'Adjustment quantity cannot be greater than current total quantity.';
    END IF;

    -- Log validation success for debugging
    RAISE NOTICE 'Stock adjustment validation passed: SKU %, Location %, Adjustment % pieces, Available % pieces',
      NEW.sku_id, NEW.location_id, v_adjustment_abs, v_available_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger on insert and update
CREATE TRIGGER trg_validate_adjustment_reserved_stock
  BEFORE INSERT OR UPDATE ON wms_stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_adjustment_reserved_stock();

-- Step 3: Add function comment
COMMENT ON FUNCTION validate_adjustment_reserved_stock() IS
  'Validates that stock decrease adjustments do not exceed available (non-reserved) quantity. Prevents adjusting reserved stock.';

-- Step 4: Create helper function to check if adjustment is allowed
CREATE OR REPLACE FUNCTION can_adjust_stock(
  p_warehouse_id VARCHAR(50),
  p_location_id VARCHAR(50),
  p_sku_id VARCHAR(50),
  p_pallet_id VARCHAR(100),
  p_adjustment_piece_qty INTEGER
)
RETURNS TABLE (
  can_adjust BOOLEAN,
  total_qty INTEGER,
  reserved_qty INTEGER,
  available_qty INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_balance_record RECORD;
  v_total INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
  v_adjustment_abs INTEGER;
BEGIN
  -- Get absolute value of adjustment
  v_adjustment_abs := ABS(p_adjustment_piece_qty);

  -- Query balance
  SELECT
    COALESCE(total_piece_qty, 0),
    COALESCE(reserved_piece_qty, 0)
  INTO v_total, v_reserved
  FROM wms_inventory_balances
  WHERE warehouse_id = p_warehouse_id
    AND location_id = p_location_id
    AND sku_id = p_sku_id
    AND (
      (pallet_id IS NULL AND p_pallet_id IS NULL) OR
      (pallet_id = p_pallet_id)
    );

  -- If no record found
  IF NOT FOUND THEN
    v_total := 0;
    v_reserved := 0;
    v_available := 0;

    IF p_adjustment_piece_qty < 0 THEN
      RETURN QUERY SELECT
        false,
        v_total,
        v_reserved,
        v_available,
        'No inventory balance found'::TEXT;
      RETURN;
    END IF;
  END IF;

  v_available := v_total - v_reserved;

  -- Check if adjustment is allowed
  IF p_adjustment_piece_qty < 0 THEN
    -- Decrease: check available quantity
    IF v_adjustment_abs > v_available THEN
      RETURN QUERY SELECT
        false,
        v_total,
        v_reserved,
        v_available,
        format('Adjustment (%s) exceeds available (%s)', v_adjustment_abs, v_available)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Adjustment is allowed
  RETURN QUERY SELECT
    true,
    v_total,
    v_reserved,
    v_available,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comment to helper function
COMMENT ON FUNCTION can_adjust_stock IS
  'Helper function to check if a stock adjustment is allowed. Returns availability status and quantities.';

-- Verification query (for testing)
-- Test the validation function
-- SELECT * FROM can_adjust_stock('WH001', 'LOC-A-01-01', 'SKU001', NULL, -100);

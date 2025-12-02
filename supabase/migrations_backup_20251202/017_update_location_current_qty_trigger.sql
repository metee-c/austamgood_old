-- Migration: Add trigger to update location current_qty and current_weight_kg
-- Description: Automatically update master_location when inventory_balances changes

-- Function to update location current quantities
CREATE OR REPLACE FUNCTION update_location_current_qty()
RETURNS TRIGGER AS $$
DECLARE
    v_location_id text;
    v_total_qty integer;
    v_total_weight numeric(18,2);
BEGIN
    -- Determine which location to update
    IF TG_OP = 'DELETE' THEN
        v_location_id := OLD.location_id;
    ELSE
        v_location_id := NEW.location_id;
    END IF;

    -- Skip if no location
    IF v_location_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total quantity for this location
    SELECT 
        COALESCE(SUM(total_piece_qty), 0),
        COALESCE(SUM(total_piece_qty * COALESCE(ms.weight_per_piece_kg, 0)), 0)
    INTO v_total_qty, v_total_weight
    FROM wms_inventory_balances ib
    LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
    WHERE ib.location_id = v_location_id;

    -- Update master_location
    UPDATE master_location
    SET 
        current_qty = v_total_qty,
        current_weight_kg = v_total_weight,
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = v_location_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_inventory_balances (INSERT)
DROP TRIGGER IF EXISTS trg_update_location_qty_insert ON wms_inventory_balances;

CREATE TRIGGER trg_update_location_qty_insert
    AFTER INSERT ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_location_current_qty();

-- Create trigger on wms_inventory_balances (UPDATE)
DROP TRIGGER IF EXISTS trg_update_location_qty_update ON wms_inventory_balances;

CREATE TRIGGER trg_update_location_qty_update
    AFTER UPDATE ON wms_inventory_balances
    FOR EACH ROW
    WHEN (OLD.total_piece_qty IS DISTINCT FROM NEW.total_piece_qty 
          OR OLD.location_id IS DISTINCT FROM NEW.location_id)
    EXECUTE FUNCTION update_location_current_qty();

-- Create trigger on wms_inventory_balances (DELETE)
DROP TRIGGER IF EXISTS trg_update_location_qty_delete ON wms_inventory_balances;

CREATE TRIGGER trg_update_location_qty_delete
    AFTER DELETE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_location_current_qty();

-- Add comment
COMMENT ON FUNCTION update_location_current_qty() IS 'Update master_location current_qty and current_weight_kg when inventory_balances changes';

-- Initialize current quantities for all existing locations
UPDATE master_location ml
SET 
    current_qty = COALESCE((
        SELECT SUM(total_piece_qty)
        FROM wms_inventory_balances
        WHERE location_id = ml.location_id
    ), 0),
    current_weight_kg = COALESCE((
        SELECT SUM(ib.total_piece_qty * COALESCE(ms.weight_per_piece_kg, 0))
        FROM wms_inventory_balances ib
        LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
        WHERE ib.location_id = ml.location_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP;

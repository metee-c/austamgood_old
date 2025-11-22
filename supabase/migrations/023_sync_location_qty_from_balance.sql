-- Migration: Sync location current_qty from inventory balances
-- Description: Create trigger to automatically update master_location.current_qty when balances change
-- Date: 2025-01-22

-- Function to update location current_qty from balances
CREATE OR REPLACE FUNCTION sync_location_qty_from_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_location_id text;
    v_total_qty numeric;
BEGIN
    -- Determine which location to update (OLD or NEW)
    IF TG_OP = 'DELETE' THEN
        v_location_id := OLD.location_id;
    ELSE
        v_location_id := NEW.location_id;
    END IF;

    -- Skip if no location
    IF v_location_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Calculate total quantity for this location across all SKUs/pallets
    SELECT COALESCE(SUM(total_piece_qty), 0)
    INTO v_total_qty
    FROM wms_inventory_balances
    WHERE location_id = v_location_id;

    -- Update master_location
    UPDATE master_location
    SET 
        current_qty = v_total_qty,
        updated_at = CURRENT_TIMESTAMP
    WHERE location_id = v_location_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_inventory_balances
DROP TRIGGER IF EXISTS trg_sync_location_qty_from_balance ON wms_inventory_balances;

CREATE TRIGGER trg_sync_location_qty_from_balance
    AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION sync_location_qty_from_balance();

COMMENT ON FUNCTION sync_location_qty_from_balance() IS 'Automatically sync master_location.current_qty from wms_inventory_balances';

-- Recalculate all location quantities from current balances
UPDATE master_location ml
SET 
    current_qty = COALESCE((
        SELECT SUM(total_piece_qty)
        FROM wms_inventory_balances
        WHERE location_id = ml.location_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE ml.location_id IS NOT NULL;

-- Show summary
DO $$
DECLARE
    v_location_count integer;
BEGIN
    SELECT COUNT(*) INTO v_location_count 
    FROM master_location 
    WHERE current_qty > 0;
    
    RAISE NOTICE 'Location quantities recalculated:';
    RAISE NOTICE '  - Locations with inventory: %', v_location_count;
END $$;

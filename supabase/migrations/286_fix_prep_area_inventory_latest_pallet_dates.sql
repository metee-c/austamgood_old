-- Migration 286: Fix preparation area inventory to get production/expiry dates from the same latest pallet
-- Purpose: Ensure production_date and expiry_date come from the same pallet (the one with latest movement)

-- ============================================================================
-- 1. Drop existing objects
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory ON wms_inventory_balances;
DROP FUNCTION IF EXISTS fn_sync_prep_area_inventory() CASCADE;

-- ============================================================================
-- 2. Create improved trigger function with single subquery for latest pallet
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_prep_area_inventory()
RETURNS TRIGGER AS $$
DECLARE
    v_prep_area_id UUID;
    v_prep_area_code VARCHAR(50);
    v_qty_per_pack NUMERIC(15,2);
    v_latest_pallet RECORD;
BEGIN
    -- Only process if location is a preparation area (exists in sku_preparation_area_mapping)
    SELECT 
        spam.preparation_area_id,
        pa.area_code
    INTO 
        v_prep_area_id,
        v_prep_area_code
    FROM sku_preparation_area_mapping spam
    INNER JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
    WHERE spam.sku_id = COALESCE(NEW.sku_id, OLD.sku_id)
        AND pa.area_code = COALESCE(NEW.location_id, OLD.location_id)
        AND pa.status = 'active'
    LIMIT 1;
    
    -- If not a mapped prep area location, skip
    IF v_prep_area_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get qty_per_pack for calculations
    SELECT qty_per_pack INTO v_qty_per_pack
    FROM master_sku
    WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id);
    
    v_qty_per_pack := COALESCE(v_qty_per_pack, 1);
    
    -- Get latest pallet info (single query to ensure consistency)
    SELECT 
        pallet_id,
        pallet_id_external,
        production_date,
        expiry_date,
        lot_no,
        last_movement_at
    INTO v_latest_pallet
    FROM wms_inventory_balances 
    WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
        AND location_id = v_prep_area_code
        AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
    ORDER BY last_movement_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    -- Aggregate all stock for this SKU in this prep area
    INSERT INTO preparation_area_inventory (
        warehouse_id,
        preparation_area_id,
        preparation_area_code,
        sku_id,
        latest_pallet_id,
        latest_pallet_id_external,
        latest_production_date,
        latest_expiry_date,
        latest_lot_no,
        available_pack_qty,
        available_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        total_pack_qty,
        total_piece_qty,
        last_movement_at,
        updated_at
    )
    SELECT
        COALESCE(NEW.warehouse_id, OLD.warehouse_id),
        v_prep_area_id,
        v_prep_area_code,
        COALESCE(NEW.sku_id, OLD.sku_id),
        -- Latest pallet info (from single query above)
        v_latest_pallet.pallet_id,
        v_latest_pallet.pallet_id_external,
        v_latest_pallet.production_date,
        v_latest_pallet.expiry_date,
        v_latest_pallet.lot_no,
        -- Aggregated quantities
        SUM(total_piece_qty - reserved_piece_qty) / v_qty_per_pack,
        SUM(total_piece_qty - reserved_piece_qty),
        SUM(reserved_piece_qty) / v_qty_per_pack,
        SUM(reserved_piece_qty),
        SUM(total_piece_qty) / v_qty_per_pack,
        SUM(total_piece_qty),
        v_latest_pallet.last_movement_at,
        NOW()
    FROM wms_inventory_balances
    WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id)
        AND location_id = v_prep_area_code
        AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
    ON CONFLICT (warehouse_id, preparation_area_code, sku_id)
    DO UPDATE SET
        latest_pallet_id = EXCLUDED.latest_pallet_id,
        latest_pallet_id_external = EXCLUDED.latest_pallet_id_external,
        latest_production_date = EXCLUDED.latest_production_date,
        latest_expiry_date = EXCLUDED.latest_expiry_date,
        latest_lot_no = EXCLUDED.latest_lot_no,
        available_pack_qty = EXCLUDED.available_pack_qty,
        available_piece_qty = EXCLUDED.available_piece_qty,
        reserved_pack_qty = EXCLUDED.reserved_pack_qty,
        reserved_piece_qty = EXCLUDED.reserved_piece_qty,
        total_pack_qty = EXCLUDED.total_pack_qty,
        total_piece_qty = EXCLUDED.total_piece_qty,
        last_movement_at = EXCLUDED.last_movement_at,
        updated_at = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Recreate trigger
-- ============================================================================
CREATE TRIGGER trg_sync_prep_area_inventory
    AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_prep_area_inventory();

-- ============================================================================
-- 4. Refresh existing data with corrected latest pallet info
-- ============================================================================
-- Update all existing records to use consistent latest pallet data
UPDATE preparation_area_inventory pai
SET 
    latest_pallet_id = latest.pallet_id,
    latest_pallet_id_external = latest.pallet_id_external,
    latest_production_date = latest.production_date,
    latest_expiry_date = latest.expiry_date,
    latest_lot_no = latest.lot_no,
    last_movement_at = latest.last_movement_at,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (sku_id, location_id, warehouse_id)
        sku_id,
        location_id,
        warehouse_id,
        pallet_id,
        pallet_id_external,
        production_date,
        expiry_date,
        lot_no,
        last_movement_at
    FROM wms_inventory_balances
    ORDER BY sku_id, location_id, warehouse_id, last_movement_at DESC NULLS LAST, created_at DESC
) latest
WHERE pai.sku_id = latest.sku_id
    AND pai.preparation_area_code = latest.location_id
    AND pai.warehouse_id = latest.warehouse_id;

-- ============================================================================
-- 5. Add comment
-- ============================================================================
COMMENT ON FUNCTION fn_sync_prep_area_inventory() IS 'Syncs preparation area inventory from wms_inventory_balances - uses single query to get latest pallet info for consistency';


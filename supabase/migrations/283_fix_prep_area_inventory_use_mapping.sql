-- Migration 283: Fix preparation area inventory to use SKU mapping instead of actual stock
-- Purpose: Show only SKUs that SHOULD be in preparation areas (from mapping), not all SKUs that ARE there

-- ============================================================================
-- 1. Drop existing objects
-- ============================================================================
DROP VIEW IF EXISTS vw_preparation_area_inventory;
DROP TABLE IF EXISTS preparation_area_inventory CASCADE;
DROP FUNCTION IF EXISTS fn_sync_prep_area_inventory() CASCADE;
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory ON wms_inventory_balances;

-- ============================================================================
-- 2. Create new preparation_area_inventory table based on MAPPING
-- ============================================================================
CREATE TABLE preparation_area_inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id VARCHAR(50) NOT NULL,
    preparation_area_id UUID NOT NULL,
    preparation_area_code VARCHAR(50) NOT NULL,
    sku_id VARCHAR(255) NOT NULL,
    
    -- Latest pallet info (from most recent stock movement)
    latest_pallet_id VARCHAR(255),
    latest_pallet_id_external VARCHAR(255),
    latest_production_date DATE,
    latest_expiry_date DATE,
    latest_lot_no VARCHAR(255),
    
    -- Aggregated quantities
    available_pack_qty NUMERIC(15,2) DEFAULT 0,
    available_piece_qty NUMERIC(15,2) DEFAULT 0,
    reserved_pack_qty NUMERIC(15,2) DEFAULT 0,
    reserved_piece_qty NUMERIC(15,2) DEFAULT 0,
    total_pack_qty NUMERIC(15,2) DEFAULT 0,
    total_piece_qty NUMERIC(15,2) DEFAULT 0,
    
    -- Metadata
    last_movement_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint: 1 row per warehouse + prep area + SKU
    UNIQUE(warehouse_id, preparation_area_code, sku_id)
);

CREATE INDEX idx_prep_area_inv_warehouse ON preparation_area_inventory(warehouse_id);
CREATE INDEX idx_prep_area_inv_prep_area ON preparation_area_inventory(preparation_area_code);
CREATE INDEX idx_prep_area_inv_sku ON preparation_area_inventory(sku_id);
CREATE INDEX idx_prep_area_inv_updated ON preparation_area_inventory(updated_at);

COMMENT ON TABLE preparation_area_inventory IS 'SKU-level aggregated inventory for preparation areas based on sku_preparation_area_mapping';

-- ============================================================================
-- 3. Create view with location validation
-- ============================================================================
CREATE VIEW vw_preparation_area_inventory AS
SELECT 
    pai.inventory_id,
    pai.warehouse_id,
    mw.warehouse_name,
    pai.preparation_area_id,
    pai.preparation_area_code,
    pa.area_name as preparation_area_name,
    pa.zone,
    pai.sku_id,
    ms.sku_name,
    ms.uom_base,
    ms.qty_per_pack,
    ms.weight_per_piece_kg,
    ms.default_location,
    pai.latest_pallet_id,
    pai.latest_pallet_id_external,
    pai.latest_production_date,
    pai.latest_expiry_date,
    pai.latest_lot_no,
    pai.available_pack_qty,
    pai.available_piece_qty,
    pai.reserved_pack_qty,
    pai.reserved_piece_qty,
    pai.total_pack_qty,
    pai.total_piece_qty,
    pai.last_movement_at,
    pai.created_at,
    pai.updated_at,
    -- Calculated fields
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL THEN 
            (pai.latest_expiry_date - CURRENT_DATE)
        ELSE NULL 
    END as days_until_expiry,
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL AND pai.latest_expiry_date < CURRENT_DATE THEN true
        ELSE false
    END as is_expired,
    -- Location validation: always TRUE because we only show mapped SKUs
    true as is_correct_location,
    NULL::VARCHAR as expected_location
FROM preparation_area_inventory pai
INNER JOIN preparation_area pa ON pa.area_id = pai.preparation_area_id
INNER JOIN master_warehouse mw ON mw.warehouse_id = pai.warehouse_id
INNER JOIN master_sku ms ON ms.sku_id = pai.sku_id
WHERE pa.status = 'active';

COMMENT ON VIEW vw_preparation_area_inventory IS 'SKU-level aggregated view of preparation area inventory based on mapping (shows only SKUs that should be in prep areas)';

-- ============================================================================
-- 4. Create trigger function to sync from wms_inventory_balances
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_prep_area_inventory()
RETURNS TRIGGER AS $$
DECLARE
    v_prep_area_id UUID;
    v_prep_area_code VARCHAR(50);
    v_qty_per_pack NUMERIC(15,2);
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
        -- Latest pallet info (most recent movement)
        (SELECT pallet_id FROM wms_inventory_balances 
         WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
           AND location_id = v_prep_area_code
           AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
         ORDER BY last_movement_at DESC NULLS LAST 
         LIMIT 1),
        (SELECT pallet_id_external FROM wms_inventory_balances 
         WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
           AND location_id = v_prep_area_code
           AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
         ORDER BY last_movement_at DESC NULLS LAST 
         LIMIT 1),
        (SELECT production_date FROM wms_inventory_balances 
         WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
           AND location_id = v_prep_area_code
           AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
         ORDER BY last_movement_at DESC NULLS LAST 
         LIMIT 1),
        (SELECT expiry_date FROM wms_inventory_balances 
         WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
           AND location_id = v_prep_area_code
           AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
         ORDER BY last_movement_at DESC NULLS LAST 
         LIMIT 1),
        (SELECT lot_no FROM wms_inventory_balances 
         WHERE sku_id = COALESCE(NEW.sku_id, OLD.sku_id) 
           AND location_id = v_prep_area_code
           AND warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
         ORDER BY last_movement_at DESC NULLS LAST 
         LIMIT 1),
        -- Aggregated quantities
        SUM(total_piece_qty - reserved_piece_qty) / v_qty_per_pack,
        SUM(total_piece_qty - reserved_piece_qty),
        SUM(reserved_piece_qty) / v_qty_per_pack,
        SUM(reserved_piece_qty),
        SUM(total_piece_qty) / v_qty_per_pack,
        SUM(total_piece_qty),
        MAX(last_movement_at),
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
-- 5. Create trigger
-- ============================================================================
CREATE TRIGGER trg_sync_prep_area_inventory
    AFTER INSERT OR UPDATE OR DELETE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_prep_area_inventory();

-- ============================================================================
-- 6. Initial data population from mapping
-- ============================================================================
-- Populate with all mapped SKUs (even if they have zero stock)
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
    spam.warehouse_id,
    spam.preparation_area_id,
    pa.area_code as preparation_area_code,
    spam.sku_id,
    -- Latest pallet info from actual stock (if exists)
    (SELECT pallet_id FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code
     ORDER BY last_movement_at DESC NULLS LAST 
     LIMIT 1),
    (SELECT pallet_id_external FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code
     ORDER BY last_movement_at DESC NULLS LAST 
     LIMIT 1),
    (SELECT production_date FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code
     ORDER BY last_movement_at DESC NULLS LAST 
     LIMIT 1),
    (SELECT expiry_date FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code
     ORDER BY last_movement_at DESC NULLS LAST 
     LIMIT 1),
    (SELECT lot_no FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code
     ORDER BY last_movement_at DESC NULLS LAST 
     LIMIT 1),
    -- Aggregated quantities (0 if no stock)
    COALESCE(
        (SELECT SUM(total_piece_qty - reserved_piece_qty) / COALESCE(ms.qty_per_pack, 1)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    COALESCE(
        (SELECT SUM(total_piece_qty - reserved_piece_qty)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    COALESCE(
        (SELECT SUM(reserved_piece_qty) / COALESCE(ms.qty_per_pack, 1)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    COALESCE(
        (SELECT SUM(reserved_piece_qty)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    COALESCE(
        (SELECT SUM(total_piece_qty) / COALESCE(ms.qty_per_pack, 1)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    COALESCE(
        (SELECT SUM(total_piece_qty)
         FROM wms_inventory_balances
         WHERE sku_id = spam.sku_id 
           AND location_id = pa.area_code), 
        0
    ),
    (SELECT MAX(last_movement_at) FROM wms_inventory_balances 
     WHERE sku_id = spam.sku_id 
       AND location_id = pa.area_code),
    NOW()
FROM sku_preparation_area_mapping spam
INNER JOIN preparation_area pa ON pa.area_id = spam.preparation_area_id
INNER JOIN master_sku ms ON ms.sku_id = spam.sku_id
WHERE pa.status = 'active'
ON CONFLICT (warehouse_id, preparation_area_code, sku_id) DO NOTHING;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT ON vw_preparation_area_inventory TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON preparation_area_inventory TO authenticated;

-- ============================================================================
-- 8. Add comment
-- ============================================================================
COMMENT ON TABLE preparation_area_inventory IS 'Preparation area inventory based on sku_preparation_area_mapping - shows only SKUs that SHOULD be in prep areas according to master data';
COMMENT ON VIEW vw_preparation_area_inventory IS 'View of preparation area inventory with enriched data - based on mapping, not actual stock locations';

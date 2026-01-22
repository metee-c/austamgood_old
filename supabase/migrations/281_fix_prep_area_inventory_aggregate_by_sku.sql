-- Migration 281: Fix Preparation Area Inventory to Aggregate by SKU Only
-- Purpose: Change from pallet-level tracking to SKU-level aggregation
-- Show 1 row per SKU with total quantities and latest pallet dates

-- ============================================================================
-- 1. Drop existing objects
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory ON wms_inventory_balances;
DROP FUNCTION IF EXISTS sync_prep_area_inventory_from_balance();
DROP FUNCTION IF EXISTS initialize_preparation_area_inventory();
DROP VIEW IF EXISTS vw_preparation_area_inventory;
DROP TABLE IF EXISTS preparation_area_inventory CASCADE;

-- ============================================================================
-- 2. Create new preparation_area_inventory table (SKU-level aggregation)
-- ============================================================================
CREATE TABLE preparation_area_inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    warehouse_id VARCHAR(50) NOT NULL,
    preparation_area_id UUID NOT NULL,
    preparation_area_code VARCHAR(50) NOT NULL,
    sku_id VARCHAR(50) NOT NULL,
    
    -- Aggregated quantities (sum of all pallets for this SKU)
    available_pack_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    available_piece_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    reserved_pack_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    reserved_piece_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    total_pack_qty NUMERIC(18,2) GENERATED ALWAYS AS (available_pack_qty + reserved_pack_qty) STORED,
    total_piece_qty NUMERIC(18,2) GENERATED ALWAYS AS (available_piece_qty + reserved_piece_qty) STORED,
    
    -- Latest pallet information (from most recent movement)
    latest_pallet_id VARCHAR(100),
    latest_pallet_id_external VARCHAR(100),
    latest_production_date DATE,
    latest_expiry_date DATE,
    latest_lot_no VARCHAR(100),
    
    -- Metadata
    last_movement_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_prep_area_inventory_warehouse 
        FOREIGN KEY (warehouse_id) REFERENCES master_warehouse(warehouse_id),
    CONSTRAINT fk_prep_area_inventory_prep_area 
        FOREIGN KEY (preparation_area_id) REFERENCES preparation_area(area_id),
    CONSTRAINT fk_prep_area_inventory_sku 
        FOREIGN KEY (sku_id) REFERENCES master_sku(sku_id),
    
    -- Unique constraint: 1 row per SKU per prep area
    CONSTRAINT uq_prep_area_inventory_sku 
        UNIQUE (warehouse_id, preparation_area_code, sku_id),
    
    -- Constraints
    CONSTRAINT chk_prep_area_available_pack_qty CHECK (available_pack_qty >= 0),
    CONSTRAINT chk_prep_area_available_piece_qty CHECK (available_piece_qty >= 0),
    CONSTRAINT chk_prep_area_reserved_pack_qty CHECK (reserved_pack_qty >= 0),
    CONSTRAINT chk_prep_area_reserved_piece_qty CHECK (reserved_piece_qty >= 0)
);

-- Indexes for performance
CREATE INDEX idx_prep_area_inventory_warehouse ON preparation_area_inventory(warehouse_id);
CREATE INDEX idx_prep_area_inventory_prep_area ON preparation_area_inventory(preparation_area_id);
CREATE INDEX idx_prep_area_inventory_sku ON preparation_area_inventory(sku_id);
CREATE INDEX idx_prep_area_inventory_expiry ON preparation_area_inventory(latest_expiry_date) WHERE latest_expiry_date IS NOT NULL;
CREATE INDEX idx_prep_area_inventory_movement ON preparation_area_inventory(last_movement_at DESC);

COMMENT ON TABLE preparation_area_inventory IS 'SKU-level aggregated inventory for preparation areas (1 row per SKU)';
COMMENT ON COLUMN preparation_area_inventory.available_pack_qty IS 'Total available quantity in packs (sum of all pallets)';
COMMENT ON COLUMN preparation_area_inventory.available_piece_qty IS 'Total available quantity in pieces (sum of all pallets)';
COMMENT ON COLUMN preparation_area_inventory.latest_production_date IS 'Production date from the most recently moved pallet';
COMMENT ON COLUMN preparation_area_inventory.latest_expiry_date IS 'Expiry date from the most recently moved pallet';

-- ============================================================================
-- 3. Create view for easy querying
-- ============================================================================
CREATE OR REPLACE VIEW vw_preparation_area_inventory AS
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
    END as is_expired
FROM preparation_area_inventory pai
INNER JOIN preparation_area pa ON pa.area_id = pai.preparation_area_id
INNER JOIN master_warehouse mw ON mw.warehouse_id = pai.warehouse_id
INNER JOIN master_sku ms ON ms.sku_id = pai.sku_id
WHERE pa.status = 'active';

COMMENT ON VIEW vw_preparation_area_inventory IS 'SKU-level aggregated view of preparation area inventory';

-- ============================================================================
-- 4. Function to initialize data from wms_inventory_balances
-- ============================================================================
CREATE OR REPLACE FUNCTION initialize_preparation_area_inventory()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clear existing data
    TRUNCATE TABLE preparation_area_inventory;
    
    -- Insert aggregated data from wms_inventory_balances
    -- Group by warehouse, prep area, and SKU
    -- Sum quantities and get latest pallet info based on last_movement_at
    INSERT INTO preparation_area_inventory (
        warehouse_id,
        preparation_area_id,
        preparation_area_code,
        sku_id,
        available_pack_qty,
        available_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        latest_pallet_id,
        latest_pallet_id_external,
        latest_production_date,
        latest_expiry_date,
        latest_lot_no,
        last_movement_at
    )
    SELECT 
        ib.warehouse_id,
        pa.area_id as preparation_area_id,
        pa.area_code as preparation_area_code,
        ib.sku_id,
        -- Sum quantities across all pallets
        SUM(GREATEST(0, ib.total_pack_qty - ib.reserved_pack_qty)) as available_pack_qty,
        SUM(GREATEST(0, ib.total_piece_qty - ib.reserved_piece_qty)) as available_piece_qty,
        SUM(ib.reserved_pack_qty) as reserved_pack_qty,
        SUM(ib.reserved_piece_qty) as reserved_piece_qty,
        -- Get info from the most recently moved pallet
        (ARRAY_AGG(ib.pallet_id ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_pallet_id,
        (ARRAY_AGG(ib.pallet_id_external ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_pallet_id_external,
        (ARRAY_AGG(ib.production_date ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_production_date,
        (ARRAY_AGG(ib.expiry_date ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_expiry_date,
        (ARRAY_AGG(ib.lot_no ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_lot_no,
        MAX(ib.last_movement_at) as last_movement_at
    FROM wms_inventory_balances ib
    INNER JOIN preparation_area pa 
        ON pa.area_code = ib.location_id 
        AND pa.status = 'active'
    WHERE (ib.total_pack_qty > 0 OR ib.total_piece_qty > 0)
    GROUP BY 
        ib.warehouse_id,
        pa.area_id,
        pa.area_code,
        ib.sku_id;
    
    RAISE NOTICE 'Initialized preparation_area_inventory with % rows', 
        (SELECT COUNT(*) FROM preparation_area_inventory);
END;
$$;

COMMENT ON FUNCTION initialize_preparation_area_inventory() IS 'Initialize SKU-level aggregated preparation_area_inventory from wms_inventory_balances';

-- ============================================================================
-- 5. Trigger to auto-sync from wms_inventory_balances
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_prep_area_inventory_from_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prep_area_id UUID;
    v_prep_area_code VARCHAR(50);
    v_aggregated RECORD;
BEGIN
    -- Check if this location is a preparation area
    SELECT area_id, area_code INTO v_prep_area_id, v_prep_area_code
    FROM preparation_area
    WHERE area_code = NEW.location_id
      AND status = 'active';
    
    -- If not a prep area, skip
    IF v_prep_area_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Aggregate all balances for this SKU in this prep area
    SELECT 
        NEW.warehouse_id as warehouse_id,
        v_prep_area_id as preparation_area_id,
        v_prep_area_code as preparation_area_code,
        NEW.sku_id as sku_id,
        SUM(GREATEST(0, ib.total_pack_qty - ib.reserved_pack_qty)) as available_pack_qty,
        SUM(GREATEST(0, ib.total_piece_qty - ib.reserved_piece_qty)) as available_piece_qty,
        SUM(ib.reserved_pack_qty) as reserved_pack_qty,
        SUM(ib.reserved_piece_qty) as reserved_piece_qty,
        (ARRAY_AGG(ib.pallet_id ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_pallet_id,
        (ARRAY_AGG(ib.pallet_id_external ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_pallet_id_external,
        (ARRAY_AGG(ib.production_date ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_production_date,
        (ARRAY_AGG(ib.expiry_date ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_expiry_date,
        (ARRAY_AGG(ib.lot_no ORDER BY ib.last_movement_at DESC NULLS LAST))[1] as latest_lot_no,
        MAX(ib.last_movement_at) as last_movement_at
    INTO v_aggregated
    FROM wms_inventory_balances ib
    WHERE ib.warehouse_id = NEW.warehouse_id
      AND ib.location_id = NEW.location_id
      AND ib.sku_id = NEW.sku_id
    GROUP BY NEW.warehouse_id, NEW.sku_id;
    
    -- Upsert into preparation_area_inventory
    INSERT INTO preparation_area_inventory (
        warehouse_id,
        preparation_area_id,
        preparation_area_code,
        sku_id,
        available_pack_qty,
        available_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        latest_pallet_id,
        latest_pallet_id_external,
        latest_production_date,
        latest_expiry_date,
        latest_lot_no,
        last_movement_at
    ) VALUES (
        v_aggregated.warehouse_id,
        v_aggregated.preparation_area_id,
        v_aggregated.preparation_area_code,
        v_aggregated.sku_id,
        v_aggregated.available_pack_qty,
        v_aggregated.available_piece_qty,
        v_aggregated.reserved_pack_qty,
        v_aggregated.reserved_piece_qty,
        v_aggregated.latest_pallet_id,
        v_aggregated.latest_pallet_id_external,
        v_aggregated.latest_production_date,
        v_aggregated.latest_expiry_date,
        v_aggregated.latest_lot_no,
        v_aggregated.last_movement_at
    )
    ON CONFLICT (warehouse_id, preparation_area_code, sku_id)
    DO UPDATE SET
        available_pack_qty = EXCLUDED.available_pack_qty,
        available_piece_qty = EXCLUDED.available_piece_qty,
        reserved_pack_qty = EXCLUDED.reserved_pack_qty,
        reserved_piece_qty = EXCLUDED.reserved_piece_qty,
        latest_pallet_id = EXCLUDED.latest_pallet_id,
        latest_pallet_id_external = EXCLUDED.latest_pallet_id_external,
        latest_production_date = EXCLUDED.latest_production_date,
        latest_expiry_date = EXCLUDED.latest_expiry_date,
        latest_lot_no = EXCLUDED.latest_lot_no,
        last_movement_at = EXCLUDED.last_movement_at,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Delete if total quantity is zero
    DELETE FROM preparation_area_inventory
    WHERE warehouse_id = v_aggregated.warehouse_id
      AND preparation_area_code = v_aggregated.preparation_area_code
      AND sku_id = v_aggregated.sku_id
      AND total_pack_qty = 0 
      AND total_piece_qty = 0;
    
    RETURN NEW;
END;
$$;

-- Create trigger on wms_inventory_balances
CREATE TRIGGER trg_sync_prep_area_inventory
    AFTER INSERT OR UPDATE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION sync_prep_area_inventory_from_balance();

COMMENT ON FUNCTION sync_prep_area_inventory_from_balance() IS 'Auto-sync SKU-level aggregated preparation_area_inventory when wms_inventory_balances changes';

-- ============================================================================
-- 6. Initialize data
-- ============================================================================
SELECT initialize_preparation_area_inventory();

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT ON preparation_area_inventory TO anon, authenticated;
GRANT SELECT ON vw_preparation_area_inventory TO anon, authenticated;
GRANT ALL ON preparation_area_inventory TO service_role;

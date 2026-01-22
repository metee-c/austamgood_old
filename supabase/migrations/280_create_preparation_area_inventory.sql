-- Migration 280: Create Preparation Area Inventory System
-- Purpose: Create dedicated table and view for preparation area inventory tracking
-- Replaces the generic wms_inventory_balances approach with prep-area specific tracking

-- ============================================================================
-- 1. Create preparation_area_inventory table
-- ============================================================================
CREATE TABLE IF NOT EXISTS preparation_area_inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    warehouse_id VARCHAR(50) NOT NULL,
    preparation_area_id UUID NOT NULL,
    preparation_area_code VARCHAR(50) NOT NULL,
    sku_id VARCHAR(50) NOT NULL,
    pallet_id VARCHAR(100),
    pallet_id_external VARCHAR(100),
    production_date DATE,
    expiry_date DATE,
    lot_no VARCHAR(100),
    
    -- Quantity tracking
    available_pack_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    available_piece_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    reserved_pack_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    reserved_piece_qty NUMERIC(18,2) DEFAULT 0 NOT NULL,
    total_pack_qty NUMERIC(18,2) GENERATED ALWAYS AS (available_pack_qty + reserved_pack_qty) STORED,
    total_piece_qty NUMERIC(18,2) GENERATED ALWAYS AS (available_piece_qty + reserved_piece_qty) STORED,
    
    -- Metadata
    last_move_item_id BIGINT,
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
    
    -- Constraints
    CONSTRAINT chk_prep_area_available_pack_qty CHECK (available_pack_qty >= 0),
    CONSTRAINT chk_prep_area_available_piece_qty CHECK (available_piece_qty >= 0),
    CONSTRAINT chk_prep_area_reserved_pack_qty CHECK (reserved_pack_qty >= 0),
    CONSTRAINT chk_prep_area_reserved_piece_qty CHECK (reserved_piece_qty >= 0)
    
    -- Note: Unique constraint will be created via unique index below to handle NULLs properly
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_warehouse ON preparation_area_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_prep_area ON preparation_area_inventory(preparation_area_id);
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_sku ON preparation_area_inventory(sku_id);
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_pallet ON preparation_area_inventory(pallet_id) WHERE pallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_expiry ON preparation_area_inventory(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_movement ON preparation_area_inventory(last_movement_at DESC);

-- Composite index for lookups (without uniqueness constraint due to NULL handling complexity)
CREATE INDEX IF NOT EXISTS idx_prep_area_inventory_lookup ON preparation_area_inventory (
    warehouse_id, 
    preparation_area_code, 
    sku_id, 
    pallet_id, 
    pallet_id_external,
    lot_no, 
    production_date, 
    expiry_date
);

COMMENT ON TABLE preparation_area_inventory IS 'Dedicated inventory tracking for preparation areas, synced from wms_inventory_balances';
COMMENT ON COLUMN preparation_area_inventory.available_pack_qty IS 'Available quantity in packs (not reserved)';
COMMENT ON COLUMN preparation_area_inventory.available_piece_qty IS 'Available quantity in pieces (not reserved)';
COMMENT ON COLUMN preparation_area_inventory.reserved_pack_qty IS 'Reserved quantity in packs';
COMMENT ON COLUMN preparation_area_inventory.reserved_piece_qty IS 'Reserved quantity in pieces';

-- ============================================================================
-- 2. Create view for easy querying
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
    pai.pallet_id,
    pai.pallet_id_external,
    pai.production_date,
    pai.expiry_date,
    pai.lot_no,
    pai.available_pack_qty,
    pai.available_piece_qty,
    pai.reserved_pack_qty,
    pai.reserved_piece_qty,
    pai.total_pack_qty,
    pai.total_piece_qty,
    pai.last_move_item_id,
    pai.last_movement_at,
    pai.created_at,
    pai.updated_at,
    -- Calculated fields
    CASE 
        WHEN pai.expiry_date IS NOT NULL THEN 
            (pai.expiry_date - CURRENT_DATE)
        ELSE NULL 
    END as days_until_expiry,
    CASE 
        WHEN pai.expiry_date IS NOT NULL AND pai.expiry_date < CURRENT_DATE THEN true
        ELSE false
    END as is_expired
FROM preparation_area_inventory pai
INNER JOIN preparation_area pa ON pa.area_id = pai.preparation_area_id
INNER JOIN master_warehouse mw ON mw.warehouse_id = pai.warehouse_id
INNER JOIN master_sku ms ON ms.sku_id = pai.sku_id
WHERE pa.status = 'active';

COMMENT ON VIEW vw_preparation_area_inventory IS 'Comprehensive view of preparation area inventory with SKU and location details';

-- ============================================================================
-- 3. Function to initialize data from wms_inventory_balances
-- ============================================================================
CREATE OR REPLACE FUNCTION initialize_preparation_area_inventory()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clear existing data
    TRUNCATE TABLE preparation_area_inventory;
    
    -- Insert data from wms_inventory_balances for preparation area locations
    INSERT INTO preparation_area_inventory (
        warehouse_id,
        preparation_area_id,
        preparation_area_code,
        sku_id,
        pallet_id,
        pallet_id_external,
        production_date,
        expiry_date,
        lot_no,
        available_pack_qty,
        available_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        last_move_item_id,
        last_movement_at
    )
    SELECT 
        ib.warehouse_id,
        pa.area_id as preparation_area_id,
        pa.area_code as preparation_area_code,
        ib.sku_id,
        ib.pallet_id,
        ib.pallet_id_external,
        ib.production_date,
        ib.expiry_date,
        ib.lot_no,
        -- Calculate available = total - reserved
        GREATEST(0, ib.total_pack_qty - ib.reserved_pack_qty) as available_pack_qty,
        GREATEST(0, ib.total_piece_qty - ib.reserved_piece_qty) as available_piece_qty,
        ib.reserved_pack_qty,
        ib.reserved_piece_qty,
        ib.last_move_id as last_move_item_id,
        ib.last_movement_at
    FROM wms_inventory_balances ib
    INNER JOIN preparation_area pa 
        ON pa.area_code = ib.location_id 
        AND pa.status = 'active'
    WHERE (ib.total_pack_qty > 0 OR ib.total_piece_qty > 0);
    
    RAISE NOTICE 'Initialized preparation_area_inventory with % rows', 
        (SELECT COUNT(*) FROM preparation_area_inventory);
END;
$$;

COMMENT ON FUNCTION initialize_preparation_area_inventory() IS 'Initialize preparation_area_inventory from wms_inventory_balances';

-- ============================================================================
-- 4. Trigger to auto-sync from wms_inventory_balances
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_prep_area_inventory_from_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prep_area_id BIGINT;
    v_prep_area_code VARCHAR(50);
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
    
    -- Upsert into preparation_area_inventory
    INSERT INTO preparation_area_inventory (
        warehouse_id,
        preparation_area_id,
        preparation_area_code,
        sku_id,
        pallet_id,
        pallet_id_external,
        production_date,
        expiry_date,
        lot_no,
        available_pack_qty,
        available_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        last_move_item_id,
        last_movement_at
    ) VALUES (
        NEW.warehouse_id,
        v_prep_area_id,
        v_prep_area_code,
        NEW.sku_id,
        NEW.pallet_id,
        NEW.pallet_id_external,
        NEW.production_date,
        NEW.expiry_date,
        NEW.lot_no,
        GREATEST(0, NEW.total_pack_qty - NEW.reserved_pack_qty),
        GREATEST(0, NEW.total_piece_qty - NEW.reserved_piece_qty),
        NEW.reserved_pack_qty,
        NEW.reserved_piece_qty,
        NEW.last_move_id,
        NEW.last_movement_at
    )
    ON CONFLICT (
        warehouse_id, 
        preparation_area_code, 
        sku_id, 
        COALESCE(pallet_id, ''), 
        COALESCE(pallet_id_external, ''),
        COALESCE(lot_no, ''), 
        COALESCE(production_date::TEXT, ''), 
        COALESCE(expiry_date::TEXT, '')
    )
    DO UPDATE SET
        available_pack_qty = GREATEST(0, EXCLUDED.total_pack_qty - EXCLUDED.reserved_pack_qty),
        available_piece_qty = GREATEST(0, EXCLUDED.total_piece_qty - EXCLUDED.reserved_piece_qty),
        reserved_pack_qty = EXCLUDED.reserved_pack_qty,
        reserved_piece_qty = EXCLUDED.reserved_piece_qty,
        last_move_item_id = EXCLUDED.last_move_item_id,
        last_movement_at = EXCLUDED.last_movement_at,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Delete if total quantity is zero
    DELETE FROM preparation_area_inventory
    WHERE warehouse_id = NEW.warehouse_id
      AND preparation_area_code = v_prep_area_code
      AND sku_id = NEW.sku_id
      AND COALESCE(pallet_id, '') = COALESCE(NEW.pallet_id, '')
      AND COALESCE(pallet_id_external, '') = COALESCE(NEW.pallet_id_external, '')
      AND COALESCE(lot_no, '') = COALESCE(NEW.lot_no, '')
      AND COALESCE(production_date::TEXT, '') = COALESCE(NEW.production_date::TEXT, '')
      AND COALESCE(expiry_date::TEXT, '') = COALESCE(NEW.expiry_date::TEXT, '')
      AND total_pack_qty = 0 
      AND total_piece_qty = 0;
    
    RETURN NEW;
END;
$$;

-- Create trigger on wms_inventory_balances
DROP TRIGGER IF EXISTS trg_sync_prep_area_inventory ON wms_inventory_balances;
CREATE TRIGGER trg_sync_prep_area_inventory
    AFTER INSERT OR UPDATE ON wms_inventory_balances
    FOR EACH ROW
    EXECUTE FUNCTION sync_prep_area_inventory_from_balance();

COMMENT ON FUNCTION sync_prep_area_inventory_from_balance() IS 'Auto-sync preparation_area_inventory when wms_inventory_balances changes';

-- ============================================================================
-- 5. Initialize data
-- ============================================================================
SELECT initialize_preparation_area_inventory();

-- ============================================================================
-- 6. Grant permissions
-- ============================================================================
GRANT SELECT ON preparation_area_inventory TO anon, authenticated;
GRANT SELECT ON vw_preparation_area_inventory TO anon, authenticated;
GRANT ALL ON preparation_area_inventory TO service_role;

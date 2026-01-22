-- Migration 285: Fix trigger 275 to DELETE old mapping before INSERT new one
-- Purpose: Ensure trigger 284 receives DELETE event to clean up old inventory records

-- ============================================================================
-- Drop and recreate the sync function
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_sku_preparation_area_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prep_area_id UUID;
    v_zone VARCHAR;
    v_old_prep_area_id UUID;
BEGIN
    -- ถ้า default_location เป็น NULL หรือว่าง ให้ลบ mapping (ถ้ามี)
    IF NEW.default_location IS NULL OR NEW.default_location = '' THEN
        DELETE FROM sku_preparation_area_mapping
        WHERE sku_id = NEW.sku_id
          AND warehouse_id = 'WH001';
        
        RAISE NOTICE 'Deleted mapping for SKU % (no default_location)', NEW.sku_id;
        RETURN NEW;
    END IF;
    
    -- หา zone จาก master_location
    SELECT ml.zone INTO v_zone
    FROM master_location ml
    WHERE ml.location_id = NEW.default_location
    LIMIT 1;
    
    -- ถ้าไม่เจอ zone ให้ลบ mapping (ถ้ามี)
    IF v_zone IS NULL THEN
        DELETE FROM sku_preparation_area_mapping
        WHERE sku_id = NEW.sku_id
          AND warehouse_id = 'WH001';
        
        RAISE NOTICE 'Deleted mapping for SKU % (location % not found)', NEW.sku_id, NEW.default_location;
        RETURN NEW;
    END IF;
    
    -- หา preparation_area_id จาก zone
    SELECT pa.area_id INTO v_prep_area_id
    FROM preparation_area pa
    WHERE pa.zone = v_zone
    LIMIT 1;
    
    -- ถ้าไม่เจอ prep area ให้ลบ mapping (ถ้ามี)
    IF v_prep_area_id IS NULL THEN
        DELETE FROM sku_preparation_area_mapping
        WHERE sku_id = NEW.sku_id
          AND warehouse_id = 'WH001';
        
        RAISE NOTICE 'Deleted mapping for SKU % (zone % not in preparation_area)', NEW.sku_id, v_zone;
        RETURN NEW;
    END IF;
    
    -- Check if mapping already exists with different prep area
    SELECT preparation_area_id INTO v_old_prep_area_id
    FROM sku_preparation_area_mapping
    WHERE sku_id = NEW.sku_id
      AND warehouse_id = 'WH001'
    LIMIT 1;
    
    -- If mapping exists with different prep area, DELETE it first
    -- This ensures trigger 284 receives DELETE event to clean up old inventory
    IF v_old_prep_area_id IS NOT NULL AND v_old_prep_area_id != v_prep_area_id THEN
        DELETE FROM sku_preparation_area_mapping
        WHERE sku_id = NEW.sku_id
          AND warehouse_id = 'WH001';
        
        RAISE NOTICE 'Deleted old mapping for SKU % (prep_area changed from % to %)', 
            NEW.sku_id, v_old_prep_area_id, v_prep_area_id;
    END IF;
    
    -- Insert new mapping
    -- If same prep area (no change), just update timestamp
    -- If different prep area, we already deleted old one above
    INSERT INTO sku_preparation_area_mapping (
        sku_id,
        warehouse_id,
        preparation_area_id,
        is_primary,
        priority,
        created_at,
        updated_at
    ) VALUES (
        NEW.sku_id,
        'WH001',
        v_prep_area_id,
        true,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE 'Synced mapping for SKU %: location=%, zone=%, prep_area_id=%', 
        NEW.sku_id, NEW.default_location, v_zone, v_prep_area_id;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_sku_preparation_area_mapping IS
'Auto-sync sku_preparation_area_mapping from master_sku.default_location (DELETE old mapping before INSERT new one to trigger cleanup)';

-- ============================================================================
-- Verify trigger still exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_sync_sku_preparation_area_mapping'
    ) THEN
        RAISE EXCEPTION 'Trigger trigger_sync_sku_preparation_area_mapping not found!';
    END IF;
    
    RAISE NOTICE '✅ Trigger exists and will use updated function';
END $$;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION sync_sku_preparation_area_mapping TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

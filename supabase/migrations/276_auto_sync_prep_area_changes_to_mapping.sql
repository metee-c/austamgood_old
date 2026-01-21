-- Migration: Auto-sync preparation_area changes to sku_preparation_area_mapping
-- When preparation_area zone or status changes, update all affected SKU mappings

-- Function to sync SKU mappings when preparation_area changes
CREATE OR REPLACE FUNCTION sync_prep_area_to_sku_mapping()
RETURNS TRIGGER AS $$
DECLARE
  v_affected_skus INTEGER := 0;
BEGIN
  -- Case 1: Zone changed - need to remap all SKUs in this prep area
  IF TG_OP = 'UPDATE' AND OLD.zone IS DISTINCT FROM NEW.zone THEN
    -- Delete old mappings for SKUs that were in this prep area
    DELETE FROM sku_preparation_area_mapping
    WHERE preparation_area_id = NEW.area_id;
    
    -- Re-create mappings for all SKUs with default_location in the NEW zone
    INSERT INTO sku_preparation_area_mapping (sku_id, preparation_area_id)
    SELECT DISTINCT
      ms.sku_id,
      NEW.area_id
    FROM master_sku ms
    INNER JOIN master_location ml ON ms.default_location = ml.location_id
    WHERE ml.zone = NEW.zone
      AND ms.default_location IS NOT NULL
    ON CONFLICT (sku_id, preparation_area_id) DO NOTHING;
    
    GET DIAGNOSTICS v_affected_skus = ROW_COUNT;
    RAISE NOTICE 'Prep area % zone changed from % to %, remapped % SKUs', 
      NEW.area_code, OLD.zone, NEW.zone, v_affected_skus;
  END IF;
  
  -- Case 2: Status changed to inactive - remove all mappings
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'inactive' THEN
    DELETE FROM sku_preparation_area_mapping
    WHERE preparation_area_id = NEW.area_id;
    
    GET DIAGNOSTICS v_affected_skus = ROW_COUNT;
    RAISE NOTICE 'Prep area % set to inactive, removed % SKU mappings', 
      NEW.area_code, v_affected_skus;
  END IF;
  
  -- Case 3: Status changed from inactive to active - recreate mappings
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'active' THEN
    INSERT INTO sku_preparation_area_mapping (sku_id, preparation_area_id)
    SELECT DISTINCT
      ms.sku_id,
      NEW.area_id
    FROM master_sku ms
    INNER JOIN master_location ml ON ms.default_location = ml.location_id
    WHERE ml.zone = NEW.zone
      AND ms.default_location IS NOT NULL
    ON CONFLICT (sku_id, preparation_area_id) DO NOTHING;
    
    GET DIAGNOSTICS v_affected_skus = ROW_COUNT;
    RAISE NOTICE 'Prep area % set to active, created % SKU mappings', 
      NEW.area_code, v_affected_skus;
  END IF;
  
  -- Case 4: New prep area created - create mappings for all SKUs in this zone
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    INSERT INTO sku_preparation_area_mapping (sku_id, preparation_area_id)
    SELECT DISTINCT
      ms.sku_id,
      NEW.area_id
    FROM master_sku ms
    INNER JOIN master_location ml ON ms.default_location = ml.location_id
    WHERE ml.zone = NEW.zone
      AND ms.default_location IS NOT NULL
    ON CONFLICT (sku_id, preparation_area_id) DO NOTHING;
    
    GET DIAGNOSTICS v_affected_skus = ROW_COUNT;
    RAISE NOTICE 'New prep area % created, mapped % SKUs', 
      NEW.area_code, v_affected_skus;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on preparation_area
DROP TRIGGER IF EXISTS trigger_sync_prep_area_to_sku_mapping ON preparation_area;
CREATE TRIGGER trigger_sync_prep_area_to_sku_mapping
  AFTER INSERT OR UPDATE ON preparation_area
  FOR EACH ROW
  EXECUTE FUNCTION sync_prep_area_to_sku_mapping();

-- Add comment
COMMENT ON FUNCTION sync_prep_area_to_sku_mapping() IS 
  'Auto-sync sku_preparation_area_mapping when preparation_area zone or status changes';
COMMENT ON TRIGGER trigger_sync_prep_area_to_sku_mapping ON preparation_area IS 
  'Trigger to sync SKU mappings when prep area changes';

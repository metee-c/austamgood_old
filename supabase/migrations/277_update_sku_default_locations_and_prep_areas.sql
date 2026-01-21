-- Migration: Update SKU default locations and preparation area mappings
-- Description: Updates default_location in master_sku and syncs with preparation area mappings
-- Date: 2026-01-21

-- Drop triggers temporarily to avoid conflicts
DROP TRIGGER IF EXISTS trg_sync_sku_preparation_area_mapping ON master_sku;
DROP TRIGGER IF EXISTS trigger_sync_prep_area_to_sku_mapping ON preparation_area;

-- Fix the trigger function to handle the correct unique constraint
CREATE OR REPLACE FUNCTION sync_sku_preparation_area_mapping()
RETURNS TRIGGER AS $function$
DECLARE
    v_prep_area_id UUID;
    v_zone VARCHAR;
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
    
    -- ลบ mapping เก่าก่อน แล้วค่อย insert ใหม่
    DELETE FROM sku_preparation_area_mapping
    WHERE sku_id = NEW.sku_id
      AND warehouse_id = 'WH001';
    
    -- Insert mapping ใหม่
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
$function$ LANGUAGE plpgsql;

-- Update default_location in master_sku table
UPDATE master_sku SET default_location = 'A10-01-001' WHERE sku_id = 'B-BEY-C|MNB|NS|010';
UPDATE master_sku SET default_location = 'A10-01-003' WHERE sku_id = 'B-BEY-C|LAM|NS|010';
UPDATE master_sku SET default_location = 'A10-01-004' WHERE sku_id = 'B-BEY-C|SAL|NS|010';
UPDATE master_sku SET default_location = 'A10-01-006' WHERE sku_id = 'B-BEY-C|TUN|NS|010';
UPDATE master_sku SET default_location = 'A10-01-007' WHERE sku_id = 'B-BEY-C|MCK|NS|010';
UPDATE master_sku SET default_location = 'A10-01-008' WHERE sku_id = 'B-BEY-D|MNB|NS|010';
UPDATE master_sku SET default_location = 'A10-01-009' WHERE sku_id = 'B-BEY-D|LAM|NS|012';
UPDATE master_sku SET default_location = 'A10-01-010' WHERE sku_id = 'B-BEY-D|SAL|NS|012';
UPDATE master_sku SET default_location = 'A10-01-011' WHERE sku_id = 'B-BEY-D|CNL|NS|012';
UPDATE master_sku SET default_location = 'A10-01-012' WHERE sku_id = 'B-BEY-D|BEF|NS|012';
UPDATE master_sku SET default_location = 'A10-01-013' WHERE sku_id = 'B-BAP-C|KNP|010';
UPDATE master_sku SET default_location = 'A10-01-014' WHERE sku_id = 'B-BAP-C|HNS|010';
UPDATE master_sku SET default_location = 'A10-01-015' WHERE sku_id = 'B-BAP-C|IND|010';
UPDATE master_sku SET default_location = 'A10-01-016' WHERE sku_id = 'B-BAP-C|WEP|010';
UPDATE master_sku SET default_location = 'A10-01-017' WHERE sku_id = 'B-BAP-C|KNP|030';
UPDATE master_sku SET default_location = 'A10-01-018' WHERE sku_id = 'B-BAP-C|HNS|030';
UPDATE master_sku SET default_location = 'A10-01-019' WHERE sku_id = 'B-BAP-C|IND|030';
UPDATE master_sku SET default_location = 'A10-01-020' WHERE sku_id = 'B-BAP-C|WEP|030';
UPDATE master_sku SET default_location = 'A10-01-021' WHERE sku_id = 'B-NET-C|FHC|040';
UPDATE master_sku SET default_location = 'A10-01-022' WHERE sku_id = 'B-NET-D|CHI-S|025';
UPDATE master_sku SET default_location = 'A10-01-023' WHERE sku_id = 'B-NET-D|CHI-L|025';
UPDATE master_sku SET default_location = 'A10-01-024' WHERE sku_id = 'B-NET-D|SAL-S|025';
UPDATE master_sku SET default_location = 'A10-01-025' WHERE sku_id = 'B-NET-D|SAL-L|025';
UPDATE master_sku SET default_location = 'A09-01-003' WHERE sku_id = 'B-NET-D|SAL-S|008';
UPDATE master_sku SET default_location = 'A09-01-002' WHERE sku_id = 'B-NET-D|SAL-L|008';
UPDATE master_sku SET default_location = 'A09-01-001' WHERE sku_id = 'B-NET-D|CHI-S|008';
UPDATE master_sku SET default_location = 'A09-01-024' WHERE sku_id = 'B-NET-D|CHI-L|008';
UPDATE master_sku SET default_location = 'A09-01-023' WHERE sku_id = 'TT-BEY-C|MNB|0005';
UPDATE master_sku SET default_location = 'A09-01-022' WHERE sku_id = 'TT-BEY-C|LAM|0005';
UPDATE master_sku SET default_location = 'A09-01-021' WHERE sku_id = 'TT-BEY-C|SAL|0005';
UPDATE master_sku SET default_location = 'A09-01-020' WHERE sku_id = 'TT-BEY-C|TUN|0005';
UPDATE master_sku SET default_location = 'A09-01-019' WHERE sku_id = 'TT-BEY-C|MCK|0005';
UPDATE master_sku SET default_location = 'A09-01-018' WHERE sku_id = 'TT-BEY-D|MNB|0005';
UPDATE master_sku SET default_location = 'A09-01-017' WHERE sku_id = 'TT-BEY-D|LAM|0005';
UPDATE master_sku SET default_location = 'A09-01-016' WHERE sku_id = 'TT-BEY-D|SAL|0005';
UPDATE master_sku SET default_location = 'A09-01-015' WHERE sku_id = 'TT-BEY-D|CNL|0005';
UPDATE master_sku SET default_location = 'A09-01-014' WHERE sku_id = 'TT-BEY-D|BEF|0005';
UPDATE master_sku SET default_location = 'A09-01-013' WHERE sku_id = 'TT-BAP-C|KNP|0005';
UPDATE master_sku SET default_location = 'A09-01-012' WHERE sku_id = 'TT-BAP-C|HNS|0005';
UPDATE master_sku SET default_location = 'A09-01-011' WHERE sku_id = 'TT-BAP-C|IND|0005';
UPDATE master_sku SET default_location = 'A09-01-010' WHERE sku_id = 'TT-BAP-C|WEP|0005';
UPDATE master_sku SET default_location = 'A09-01-009' WHERE sku_id = 'TT-NET-C|FNC|0005';
UPDATE master_sku SET default_location = 'A09-01-007' WHERE sku_id = 'TT-NET-C|SAL|0005';
UPDATE master_sku SET default_location = 'A09-01-006' WHERE sku_id = 'TT-NET-C|FHC|0005';
UPDATE master_sku SET default_location = 'A09-01-005' WHERE sku_id = 'TT-NET-C|CNT|0005';
UPDATE master_sku SET default_location = 'A09-01-004' WHERE sku_id = 'TT-NET-D|CHI-S|0005';
UPDATE master_sku SET default_location = 'A10-01-026' WHERE sku_id = 'TT-NET-D|CHI-L|0005';
UPDATE master_sku SET default_location = 'A09-01-026' WHERE sku_id = 'TT-NET-D|SAL-S|0005';
UPDATE master_sku SET default_location = 'A09-01-025' WHERE sku_id = 'TT-NET-D|SAL-L|0005';

-- Create preparation areas A09 and A10 if they don't exist
INSERT INTO preparation_area (area_id, area_code, area_name, warehouse_id, zone, area_type, status, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'A09', 'Preparation Area A09', 'WH001', 'A09', 'PICKING', 'active', NOW(), NOW()),
    (gen_random_uuid(), 'A10', 'Preparation Area A10', 'WH001', 'A10', 'PICKING', 'active', NOW(), NOW())
ON CONFLICT (warehouse_id, area_code) DO NOTHING;

-- Remove old mappings for these SKUs
DELETE FROM sku_preparation_area_mapping 
WHERE sku_id IN (
    'B-BEY-C|MNB|NS|010', 'B-BEY-C|LAM|NS|010', 'B-BEY-C|SAL|NS|010',
    'B-BEY-C|TUN|NS|010', 'B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010',
    'B-BEY-D|LAM|NS|012', 'B-BEY-D|SAL|NS|012', 'B-BEY-D|CNL|NS|012',
    'B-BEY-D|BEF|NS|012', 'B-BAP-C|KNP|010', 'B-BAP-C|HNS|010',
    'B-BAP-C|IND|010', 'B-BAP-C|WEP|010', 'B-BAP-C|KNP|030',
    'B-BAP-C|HNS|030', 'B-BAP-C|IND|030', 'B-BAP-C|WEP|030',
    'B-NET-C|FHC|040', 'B-NET-D|CHI-S|025', 'B-NET-D|CHI-L|025',
    'B-NET-D|SAL-S|025', 'B-NET-D|SAL-L|025', 'B-NET-D|SAL-S|008',
    'B-NET-D|SAL-L|008', 'B-NET-D|CHI-S|008', 'B-NET-D|CHI-L|008',
    'TT-BEY-C|MNB|0005', 'TT-BEY-C|LAM|0005', 'TT-BEY-C|SAL|0005',
    'TT-BEY-C|TUN|0005', 'TT-BEY-C|MCK|0005', 'TT-BEY-D|MNB|0005',
    'TT-BEY-D|LAM|0005', 'TT-BEY-D|SAL|0005', 'TT-BEY-D|CNL|0005',
    'TT-BEY-D|BEF|0005', 'TT-BAP-C|KNP|0005', 'TT-BAP-C|HNS|0005',
    'TT-BAP-C|IND|0005', 'TT-BAP-C|WEP|0005', 'TT-NET-C|FNC|0005',
    'TT-NET-C|SAL|0005', 'TT-NET-C|FHC|0005', 'TT-NET-C|CNT|0005',
    'TT-NET-D|CHI-S|0005', 'TT-NET-D|CHI-L|0005', 'TT-NET-D|SAL-S|0005',
    'TT-NET-D|SAL-L|0005'
);

-- Insert new mappings for A10 SKUs
INSERT INTO sku_preparation_area_mapping (
    mapping_id,
    sku_id,
    warehouse_id,
    preparation_area_id,
    is_primary,
    priority,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    ms.sku_id,
    'WH001',
    pa.area_id,
    true,
    1,
    NOW(),
    NOW()
FROM master_sku ms
CROSS JOIN preparation_area pa
WHERE ms.default_location LIKE 'A10-%'
    AND pa.area_code = 'A10'
    AND ms.sku_id IN (
        'B-BEY-C|MNB|NS|010', 'B-BEY-C|LAM|NS|010', 'B-BEY-C|SAL|NS|010',
        'B-BEY-C|TUN|NS|010', 'B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010',
        'B-BEY-D|LAM|NS|012', 'B-BEY-D|SAL|NS|012', 'B-BEY-D|CNL|NS|012',
        'B-BEY-D|BEF|NS|012', 'B-BAP-C|KNP|010', 'B-BAP-C|HNS|010',
        'B-BAP-C|IND|010', 'B-BAP-C|WEP|010', 'B-BAP-C|KNP|030',
        'B-BAP-C|HNS|030', 'B-BAP-C|IND|030', 'B-BAP-C|WEP|030',
        'B-NET-C|FHC|040', 'B-NET-D|CHI-S|025', 'B-NET-D|CHI-L|025',
        'B-NET-D|SAL-S|025', 'B-NET-D|SAL-L|025', 'TT-NET-D|CHI-L|0005'
    );

-- Insert new mappings for A09 SKUs
INSERT INTO sku_preparation_area_mapping (
    mapping_id,
    sku_id,
    warehouse_id,
    preparation_area_id,
    is_primary,
    priority,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    ms.sku_id,
    'WH001',
    pa.area_id,
    true,
    1,
    NOW(),
    NOW()
FROM master_sku ms
CROSS JOIN preparation_area pa
WHERE ms.default_location LIKE 'A09-%'
    AND pa.area_code = 'A09'
    AND ms.sku_id IN (
        'B-NET-D|SAL-S|008', 'B-NET-D|SAL-L|008', 'B-NET-D|CHI-S|008',
        'B-NET-D|CHI-L|008', 'TT-BEY-C|MNB|0005', 'TT-BEY-C|LAM|0005',
        'TT-BEY-C|SAL|0005', 'TT-BEY-C|TUN|0005', 'TT-BEY-C|MCK|0005',
        'TT-BEY-D|MNB|0005', 'TT-BEY-D|LAM|0005', 'TT-BEY-D|SAL|0005',
        'TT-BEY-D|CNL|0005', 'TT-BEY-D|BEF|0005', 'TT-BAP-C|KNP|0005',
        'TT-BAP-C|HNS|0005', 'TT-BAP-C|IND|0005', 'TT-BAP-C|WEP|0005',
        'TT-NET-C|FNC|0005', 'TT-NET-C|SAL|0005', 'TT-NET-C|FHC|0005',
        'TT-NET-C|CNT|0005', 'TT-NET-D|CHI-S|0005', 'TT-NET-D|SAL-S|0005',
        'TT-NET-D|SAL-L|0005'
    );

-- Recreate the trigger (if the function exists)
-- Recreate the triggers
CREATE TRIGGER trg_sync_sku_preparation_area_mapping
    AFTER UPDATE OF default_location ON master_sku
    FOR EACH ROW
    EXECUTE FUNCTION sync_sku_preparation_area_mapping();

CREATE TRIGGER trigger_sync_prep_area_to_sku_mapping
    AFTER INSERT OR UPDATE ON preparation_area
    FOR EACH ROW
    EXECUTE FUNCTION sync_prep_area_to_sku_mapping();

-- Log the changes
DO $$
DECLARE
    updated_count INTEGER;
    a09_count INTEGER;
    a10_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM master_sku
    WHERE sku_id IN (
        'B-BEY-C|MNB|NS|010', 'B-BEY-C|LAM|NS|010', 'B-BEY-C|SAL|NS|010',
        'B-BEY-C|TUN|NS|010', 'B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010',
        'B-BEY-D|LAM|NS|012', 'B-BEY-D|SAL|NS|012', 'B-BEY-D|CNL|NS|012',
        'B-BEY-D|BEF|NS|012', 'B-BAP-C|KNP|010', 'B-BAP-C|HNS|010',
        'B-BAP-C|IND|010', 'B-BAP-C|WEP|010', 'B-BAP-C|KNP|030',
        'B-BAP-C|HNS|030', 'B-BAP-C|IND|030', 'B-BAP-C|WEP|030',
        'B-NET-C|FHC|040', 'B-NET-D|CHI-S|025', 'B-NET-D|CHI-L|025',
        'B-NET-D|SAL-S|025', 'B-NET-D|SAL-L|025', 'B-NET-D|SAL-S|008',
        'B-NET-D|SAL-L|008', 'B-NET-D|CHI-S|008', 'B-NET-D|CHI-L|008',
        'TT-BEY-C|MNB|0005', 'TT-BEY-C|LAM|0005', 'TT-BEY-C|SAL|0005',
        'TT-BEY-C|TUN|0005', 'TT-BEY-C|MCK|0005', 'TT-BEY-D|MNB|0005',
        'TT-BEY-D|LAM|0005', 'TT-BEY-D|SAL|0005', 'TT-BEY-D|CNL|0005',
        'TT-BEY-D|BEF|0005', 'TT-BAP-C|KNP|0005', 'TT-BAP-C|HNS|0005',
        'TT-BAP-C|IND|0005', 'TT-BAP-C|WEP|0005', 'TT-NET-C|FNC|0005',
        'TT-NET-C|SAL|0005', 'TT-NET-C|FHC|0005', 'TT-NET-C|CNT|0005',
        'TT-NET-D|CHI-S|0005', 'TT-NET-D|CHI-L|0005', 'TT-NET-D|SAL-S|0005',
        'TT-NET-D|SAL-L|0005'
    );
    
    SELECT COUNT(*) INTO a09_count FROM master_sku WHERE default_location LIKE 'A09-%';
    SELECT COUNT(*) INTO a10_count FROM master_sku WHERE default_location LIKE 'A10-%';
    
    RAISE NOTICE 'Migration 277 completed: Updated % SKU default locations (A09: %, A10: %)', updated_count, a09_count, a10_count;
END $$;
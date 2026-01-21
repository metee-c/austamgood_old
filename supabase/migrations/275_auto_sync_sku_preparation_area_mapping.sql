-- ============================================================================
-- Migration: 275_auto_sync_sku_preparation_area_mapping.sql
-- Description: Auto-sync sku_preparation_area_mapping จาก master_sku.default_location
-- 
-- ปัญหา:
-- - มี SKU 472 ตัวที่มี default_location แต่มีเพียง 120 ตัวที่มี mapping
-- - ขาดหายไป 352 ตัว (74.6%) ที่ไม่มี mapping
-- - ทำให้ตอนสร้าง Bonus Face Sheet เกิด error "SKU ยังไม่ได้กำหนดบ้านหยิบ"
-- 
-- แก้ไข:
-- 1. สร้าง trigger auto-sync เมื่อ INSERT/UPDATE master_sku.default_location
-- 2. Backfill ข้อมูลที่ขาดหายไปทั้งหมด
-- ============================================================================

-- ============================================================================
-- PART 1: Helper Function - Sync SKU Preparation Area Mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_sku_preparation_area_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
    
    -- Insert หรือ Update mapping
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
    )
    ON CONFLICT (sku_id, warehouse_id)
    DO UPDATE SET
        preparation_area_id = EXCLUDED.preparation_area_id,
        updated_at = CURRENT_TIMESTAMP;
    
    RAISE NOTICE 'Synced mapping for SKU %: location=%, zone=%, prep_area_id=%', 
        NEW.sku_id, NEW.default_location, v_zone, v_prep_area_id;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_sku_preparation_area_mapping IS
'Auto-sync sku_preparation_area_mapping จาก master_sku.default_location';

-- ============================================================================
-- PART 2: Create Trigger
-- ============================================================================

-- Drop trigger ถ้ามีอยู่แล้ว
DROP TRIGGER IF EXISTS trigger_sync_sku_preparation_area_mapping ON master_sku;

-- สร้าง trigger ใหม่
CREATE TRIGGER trigger_sync_sku_preparation_area_mapping
    AFTER INSERT OR UPDATE OF default_location ON master_sku
    FOR EACH ROW
    EXECUTE FUNCTION sync_sku_preparation_area_mapping();

COMMENT ON TRIGGER trigger_sync_sku_preparation_area_mapping ON master_sku IS
'Auto-sync sku_preparation_area_mapping เมื่อมีการ INSERT/UPDATE default_location';

-- ============================================================================
-- PART 3: Backfill Missing Mappings
-- ============================================================================

DO $$
DECLARE
    v_sku RECORD;
    v_prep_area_id UUID;
    v_zone VARCHAR;
    v_inserted_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Starting backfill of missing SKU preparation area mappings...';
    
    -- Loop ผ่าน SKU ทั้งหมดที่มี default_location แต่ไม่มี mapping
    FOR v_sku IN
        SELECT 
            ms.sku_id,
            ms.default_location,
            ml.zone
        FROM master_sku ms
        LEFT JOIN master_location ml ON ms.default_location = ml.location_id
        LEFT JOIN sku_preparation_area_mapping spam 
            ON ms.sku_id = spam.sku_id AND spam.warehouse_id = 'WH001'
        WHERE ms.default_location IS NOT NULL
          AND ms.default_location != ''
          AND spam.sku_id IS NULL  -- ไม่มี mapping
        ORDER BY ms.sku_id
    LOOP
        -- ถ้าไม่เจอ zone ให้ skip
        IF v_sku.zone IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            RAISE NOTICE '  ⚠️ Skipped SKU % (location % not found)', 
                v_sku.sku_id, v_sku.default_location;
            CONTINUE;
        END IF;
        
        -- หา preparation_area_id จาก zone
        SELECT pa.area_id INTO v_prep_area_id
        FROM preparation_area pa
        WHERE pa.zone = v_sku.zone
        LIMIT 1;
        
        -- ถ้าไม่เจอ prep area ให้ skip
        IF v_prep_area_id IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            RAISE NOTICE '  ⚠️ Skipped SKU % (zone % not in preparation_area)', 
                v_sku.sku_id, v_sku.zone;
            CONTINUE;
        END IF;
        
        -- Insert mapping
        INSERT INTO sku_preparation_area_mapping (
            sku_id,
            warehouse_id,
            preparation_area_id,
            is_primary,
            priority,
            created_at,
            updated_at
        ) VALUES (
            v_sku.sku_id,
            'WH001',
            v_prep_area_id,
            true,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
        
        v_inserted_count := v_inserted_count + 1;
        
        -- Log ทุก 50 records
        IF v_inserted_count % 50 = 0 THEN
            RAISE NOTICE '  ✅ Inserted % mappings...', v_inserted_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Backfill complete: inserted=%, skipped=%', v_inserted_count, v_skipped_count;
END $$;

-- ============================================================================
-- PART 4: Verify Results
-- ============================================================================

DO $$
DECLARE
    v_total_with_default INTEGER;
    v_total_with_mapping INTEGER;
    v_total_missing INTEGER;
BEGIN
    -- นับจำนวน SKU ที่มี default_location
    SELECT COUNT(*) INTO v_total_with_default
    FROM master_sku
    WHERE default_location IS NOT NULL
      AND default_location != '';
    
    -- นับจำนวน SKU ที่มี mapping
    SELECT COUNT(DISTINCT spam.sku_id) INTO v_total_with_mapping
    FROM master_sku ms
    INNER JOIN sku_preparation_area_mapping spam 
        ON ms.sku_id = spam.sku_id AND spam.warehouse_id = 'WH001'
    WHERE ms.default_location IS NOT NULL
      AND ms.default_location != '';
    
    v_total_missing := v_total_with_default - v_total_with_mapping;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Verification Results:';
    RAISE NOTICE '  - SKUs with default_location: %', v_total_with_default;
    RAISE NOTICE '  - SKUs with mapping: %', v_total_with_mapping;
    RAISE NOTICE '  - SKUs still missing: %', v_total_missing;
    
    IF v_total_missing > 0 THEN
        RAISE WARNING '⚠️ Still have % SKUs without mapping (likely due to invalid location/zone)', v_total_missing;
    ELSE
        RAISE NOTICE '✅ All SKUs with default_location now have mapping!';
    END IF;
END $$;

-- ============================================================================
-- PART 5: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION sync_sku_preparation_area_mapping TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

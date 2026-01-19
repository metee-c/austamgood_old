-- Migration 235: แก้ไขปัญหา Picklist ซ้ำซ้อนใน Loadlists
-- BUG010: ลบ loadlist ที่ pending และมี picklist ที่ถูกโหลดไปแล้วโดย loadlist อื่น

-- ✅ STEP 1: ระบุ loadlist ที่มีปัญหา (pending + มี picklist ที่ loaded แล้ว)
-- จาก analysis พบ 11 loadlists ที่มีปัญหา

DO $$
DECLARE
  v_affected_loadlists INTEGER[];
  v_loadlist_id INTEGER;
  v_deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Migration 235: Fix Duplicate Picklist in Loadlists ===';
  
  -- ✅ STEP 2: หา loadlist ที่ pending และมี picklist ที่ loaded แล้วโดย loadlist อื่น
  SELECT ARRAY_AGG(DISTINCT lp1.loadlist_id)
  INTO v_affected_loadlists
  FROM wms_loadlist_picklists lp1
  JOIN loadlists l1 ON l1.id = lp1.loadlist_id
  WHERE l1.status = 'pending'
    AND lp1.loaded_at IS NULL
    AND EXISTS (
      -- มี loadlist อื่นที่ใช้ picklist เดียวกันและโหลดเสร็จแล้ว
      SELECT 1
      FROM wms_loadlist_picklists lp2
      JOIN loadlists l2 ON l2.id = lp2.loadlist_id
      WHERE lp2.picklist_id = lp1.picklist_id
        AND lp2.loadlist_id != lp1.loadlist_id
        AND lp2.loaded_at IS NOT NULL
    );
  
  RAISE NOTICE 'Found % loadlists with duplicate picklists', COALESCE(array_length(v_affected_loadlists, 1), 0);
  
  -- ✅ STEP 3: ลบ mapping records ก่อน (foreign key dependencies)
  IF v_affected_loadlists IS NOT NULL THEN
    -- ลบ wms_loadlist_picklists
    DELETE FROM wms_loadlist_picklists
    WHERE loadlist_id = ANY(v_affected_loadlists);
    
    RAISE NOTICE 'Deleted picklist mappings for affected loadlists';
    
    -- ลบ loadlist_face_sheets (ถ้ามี)
    DELETE FROM loadlist_face_sheets
    WHERE loadlist_id = ANY(v_affected_loadlists);
    
    RAISE NOTICE 'Deleted face sheet mappings for affected loadlists';
    
    -- ลบ wms_loadlist_bonus_face_sheets (ถ้ามี)
    DELETE FROM wms_loadlist_bonus_face_sheets
    WHERE loadlist_id = ANY(v_affected_loadlists);
    
    RAISE NOTICE 'Deleted bonus face sheet mappings for affected loadlists';
    
    -- ✅ STEP 4: ลบ loadlist records
    DELETE FROM loadlists
    WHERE id = ANY(v_affected_loadlists);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % loadlists', v_deleted_count;
  ELSE
    RAISE NOTICE 'No affected loadlists found';
  END IF;
  
  -- ✅ STEP 5: แสดงสรุป
  RAISE NOTICE '=== Summary ===';
  RAISE NOTICE 'Deleted loadlists: %', v_deleted_count;
  RAISE NOTICE 'Migration 235 completed successfully';
  
END $$;

-- ✅ VERIFICATION: ตรวจสอบว่าไม่มี picklist ซ้ำซ้อนแล้ว
DO $$
DECLARE
  v_duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_duplicate_count
  FROM (
    SELECT picklist_id
    FROM wms_loadlist_picklists
    GROUP BY picklist_id
    HAVING COUNT(DISTINCT loadlist_id) > 1
  ) duplicates;
  
  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'Still found % picklists mapped to multiple loadlists', v_duplicate_count;
  ELSE
    RAISE NOTICE '✅ No duplicate picklists found - migration successful';
  END IF;
END $$;

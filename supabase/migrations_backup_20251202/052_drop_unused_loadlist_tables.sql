-- Migration: Drop Unused Loadlist Tables
-- Description: ลบตารางเก่าที่ไม่ได้ใช้งานแล้ว (load_lists และ load_list_items)
-- Date: 2025-11-29
-- Author: System Cleanup

-- ============================================================
-- SUMMARY
-- ============================================================
-- ตารางที่จะลบ:
-- 1. load_lists - ตารางเก่า (ชื่อแบบ snake_case แยกคำ) - ไม่ได้ใช้งาน
-- 2. load_list_items - ตารางเก่า - ไม่ได้ใช้งาน
--
-- ตารางที่ยังใช้งานอยู่ (ไม่ลบ):
-- - loadlists - ตารางหลักใบโหลด
-- - wms_loadlist_picklists - เชื่อม loadlist กับ picklists
-- - loadlist_items - เก็บ orders ที่ถูกสแกนขึ้นรถ
-- ============================================================

-- ตรวจสอบว่าตารางว่างเปล่าก่อนลบ
DO $$
DECLARE
  load_lists_count INTEGER;
  load_list_items_count INTEGER;
BEGIN
  -- นับจำนวนข้อมูลในตาราง
  SELECT COUNT(*) INTO load_lists_count FROM load_lists;
  SELECT COUNT(*) INTO load_list_items_count FROM load_list_items;
  
  -- แสดงผลการตรวจสอบ
  RAISE NOTICE 'load_lists has % rows', load_lists_count;
  RAISE NOTICE 'load_list_items has % rows', load_list_items_count;
  
  -- ถ้ามีข้อมูล ให้หยุดและแจ้งเตือน
  IF load_lists_count > 0 OR load_list_items_count > 0 THEN
    RAISE EXCEPTION 'Tables are not empty! Please backup data before dropping.';
  END IF;
END $$;

-- ลบ Foreign Key Constraints ก่อน
ALTER TABLE IF EXISTS load_list_items 
  DROP CONSTRAINT IF EXISTS fk_load_list_items_load_list;

ALTER TABLE IF EXISTS load_list_items 
  DROP CONSTRAINT IF EXISTS fk_load_list_items_picklist;

ALTER TABLE IF EXISTS load_lists 
  DROP CONSTRAINT IF EXISTS fk_load_lists_vehicle;

ALTER TABLE IF EXISTS load_lists 
  DROP CONSTRAINT IF EXISTS fk_load_lists_driver;

-- ลบ Indexes
DROP INDEX IF EXISTS idx_load_list_items_load_list;
DROP INDEX IF EXISTS idx_load_list_items_picklist;
DROP INDEX IF EXISTS idx_load_lists_load_date;
DROP INDEX IF EXISTS idx_load_lists_status;

-- ลบ Sequences
DROP SEQUENCE IF EXISTS load_list_items_id_seq CASCADE;
DROP SEQUENCE IF EXISTS load_lists_id_seq CASCADE;

-- ลบตาราง
DROP TABLE IF EXISTS load_list_items CASCADE;
DROP TABLE IF EXISTS load_lists CASCADE;

-- แสดงผลสำเร็จ
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully dropped unused tables: load_lists, load_list_items';
  RAISE NOTICE '✅ Active tables remain: loadlists, wms_loadlist_picklists, loadlist_items';
END $$;

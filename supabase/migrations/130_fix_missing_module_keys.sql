-- ==========================================
-- Migration: 130_fix_missing_module_keys.sql
-- Description: เพิ่ม module_key ให้กับ permission modules ที่ยังไม่มี
-- Author: System Auditor
-- Date: 2025-12-08
-- Dependencies: 117_insert_permission_modules_part2.sql
-- ==========================================

-- อัปเดต module_key สำหรับ Master Data modules (legacy)
UPDATE master_permission_module
SET module_key = 'legacy.master.customers'
WHERE module_id = 3 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.suppliers'
WHERE module_id = 4 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.employees'
WHERE module_id = 5 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.vehicles'
WHERE module_id = 6 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.warehouses'
WHERE module_id = 7 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.locations'
WHERE module_id = 8 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.master.assets'
WHERE module_id = 9 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.reports'
WHERE module_id = 16 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.files'
WHERE module_id = 17 AND module_key IS NULL;

UPDATE master_permission_module
SET module_key = 'legacy.settings'
WHERE module_id = 18 AND module_key IS NULL;

-- เพิ่ม comments
COMMENT ON COLUMN master_permission_module.module_key IS 'Unique key for permission module (required for permission checking)';

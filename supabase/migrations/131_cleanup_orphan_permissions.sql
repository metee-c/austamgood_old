-- ==========================================
-- Migration: 131_cleanup_orphan_permissions.sql
-- Description: ลบ permission records ที่ can_view = false และไม่ได้ใช้งาน
-- Author: System Auditor
-- Date: 2025-12-08
-- Dependencies: 130_fix_missing_module_keys.sql
-- Note: This is OPTIONAL - orphan records don't affect system functionality
-- ==========================================

-- ลบ orphan permissions
-- เฉพาะ parent modules ที่ can_view = false และไม่ได้ใช้งาน
DELETE FROM role_permission
WHERE role_id = 12  -- Driver RT
  AND module_id = 300  -- mobile (parent module)
  AND can_view = false;

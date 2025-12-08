-- Migration: Add RLS policies for role management
-- Created: 2025-12-08
-- Description: เพิ่ม RLS policies เพื่อให้ service role สามารถจัดการ roles ได้

-- ลบ policies เก่าถ้ามี (เพื่อป้องกัน duplicate)
DROP POLICY IF EXISTS "Allow service role to update roles" ON master_system_role;
DROP POLICY IF EXISTS "Allow service role to insert roles" ON master_system_role;
DROP POLICY IF EXISTS "Allow service role to delete roles" ON master_system_role;
DROP POLICY IF EXISTS "Allow service role to update role permissions" ON role_permission;
DROP POLICY IF EXISTS "Allow service role to insert role permissions" ON role_permission;
DROP POLICY IF EXISTS "Allow service role to delete role permissions" ON role_permission;

-- เพิ่ม UPDATE policy สำหรับ master_system_role
CREATE POLICY "Allow service role to update roles"
ON master_system_role
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- เพิ่ม INSERT policy สำหรับ master_system_role
CREATE POLICY "Allow service role to insert roles"
ON master_system_role
FOR INSERT
TO service_role
WITH CHECK (true);

-- เพิ่ม DELETE policy สำหรับ master_system_role
CREATE POLICY "Allow service role to delete roles"
ON master_system_role
FOR DELETE
TO service_role
USING (true);

-- เพิ่ม policies สำหรับ role_permission table ด้วย
CREATE POLICY "Allow service role to update role permissions"
ON role_permission
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role to insert role permissions"
ON role_permission
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Allow service role to delete role permissions"
ON role_permission
FOR DELETE
TO service_role
USING (true);

-- Comment
COMMENT ON POLICY "Allow service role to update roles" ON master_system_role IS 
'อนุญาตให้ service role แก้ไข roles ได้';

COMMENT ON POLICY "Allow service role to insert roles" ON master_system_role IS 
'อนุญาตให้ service role สร้าง roles ใหม่ได้';

COMMENT ON POLICY "Allow service role to delete roles" ON master_system_role IS 
'อนุญาตให้ service role ลบ roles ได้';

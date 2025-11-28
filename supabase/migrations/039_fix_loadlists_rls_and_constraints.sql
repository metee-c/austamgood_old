-- ============================================================
-- Migration 039: Fix Loadlists RLS and Constraints
-- ============================================================
-- แก้ไข RLS policies และ constraints สำหรับ loadlists
-- เพื่อให้ระบบทำงานได้โดยไม่ต้องเช็ค authentication
-- Date: 2025-11-26

-- ============================================================
-- PART 1: Add anon policies to loadlists
-- ============================================================

-- Loadlists policies for anon
CREATE POLICY IF NOT EXISTS "Enable read access for anon users"
ON public.loadlists
FOR SELECT
TO anon
USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for anon users"
ON public.loadlists
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for anon users"
ON public.loadlists
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable delete for anon users"
ON public.loadlists
FOR DELETE
TO anon
USING (true);

-- ============================================================
-- PART 2: Add anon policies to wms_loadlist_picklists
-- ============================================================

-- wms_loadlist_picklists policies for anon
CREATE POLICY IF NOT EXISTS "Enable read access for anon users"
ON public.wms_loadlist_picklists
FOR SELECT
TO anon
USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for anon users"
ON public.wms_loadlist_picklists
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for anon users"
ON public.wms_loadlist_picklists
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable delete for anon users"
ON public.wms_loadlist_picklists
FOR DELETE
TO anon
USING (true);

-- ============================================================
-- PART 3: Disable RLS for loadlists and related tables
-- ============================================================
-- เพื่อให้ระบบทำงานได้โดยไม่ต้องเช็ค authentication เลย

ALTER TABLE public.loadlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_loadlist_picklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loadlist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.picklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_list_items DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 4: Add Comments
-- ============================================================

COMMENT ON TABLE public.loadlists IS 'ใบโหลดสินค้าขึ้นรถ - RLS disabled for unrestricted access';
COMMENT ON TABLE public.wms_loadlist_picklists IS 'ตารางเชื่อมระหว่าง loadlists และ picklists - RLS disabled for unrestricted access';

-- ============================================================
-- Migration Summary
-- ============================================================
-- 1. ✅ เพิ่ม anon policies สำหรับ loadlists (4 policies)
-- 2. ✅ เพิ่ม anon policies สำหรับ wms_loadlist_picklists (4 policies)
-- 3. ✅ ปิด RLS สำหรับตาราง loadlists และตารางที่เกี่ยวข้อง
-- 4. ✅ เพิ่ม Comments

-- Note: Foreign key constraint names:
-- - fk_wms_loadlist_picklists_loadlist (loadlist_id → loadlists.id)
-- - fk_wms_loadlist_picklists_picklist (picklist_id → picklists.id)
-- - fk_wms_loadlist_picklists_employee (loaded_by_employee_id → master_employee.employee_id)

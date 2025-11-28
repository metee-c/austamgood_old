-- ============================================================
-- Migration 041: Add Driver Phone and Helper Employee to Loadlists
-- ============================================================
-- เพิ่มฟิลด์เบอร์โทรคนขับและเด็กติดรถ
-- Date: 2025-11-27

-- ============================================================
-- PART 1: Add New Columns to loadlists
-- ============================================================

ALTER TABLE public.loadlists
ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS helper_employee_id BIGINT;

-- ============================================================
-- PART 2: Add Foreign Key for Helper Employee
-- ============================================================

ALTER TABLE public.loadlists
ADD CONSTRAINT fk_loadlists_helper_employee
FOREIGN KEY (helper_employee_id)
REFERENCES public.master_employee(employee_id)
ON DELETE SET NULL;

-- ============================================================
-- PART 3: Add Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_loadlists_helper_employee
ON public.loadlists(helper_employee_id);

-- ============================================================
-- PART 4: Add Comments
-- ============================================================

COMMENT ON COLUMN public.loadlists.driver_phone IS 'เบอร์โทรศัพท์คนขับรถ';
COMMENT ON COLUMN public.loadlists.helper_employee_id IS 'เด็กติดรถ/ผู้ช่วยคนขับ (FK to master_employee)';

-- ============================================================
-- Migration Summary
-- ============================================================
-- 1. ✅ เพิ่มคอลัมน์ driver_phone (เบอร์โทรคนขับ)
-- 2. ✅ เพิ่มคอลัมน์ helper_employee_id (เด็กติดรถ)
-- 3. ✅ เพิ่ม Foreign Key สำหรับ helper_employee_id
-- 4. ✅ สร้าง Index สำหรับ query performance
-- 5. ✅ เพิ่ม Comments ภาษาไทย

-- Usage Example:
-- UPDATE loadlists SET
--   driver_phone = '081-234-5678',
--   helper_employee_id = 456
-- WHERE id = 1;

-- ============================================================
-- Migration 040: Add Delivery/Loading Fields to Loadlists
-- ============================================================
-- เพิ่มฟิลด์สำหรับการโหลดสินค้าและจัดส่ง
-- Date: 2025-11-26

-- ============================================================
-- PART 1: Add New Columns to loadlists
-- ============================================================

ALTER TABLE public.loadlists
ADD COLUMN IF NOT EXISTS loading_door_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS loading_queue_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS checker_employee_id BIGINT,
ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_number VARCHAR(100);

-- ============================================================
-- PART 2: Add Foreign Key for Checker Employee
-- ============================================================

ALTER TABLE public.loadlists
ADD CONSTRAINT fk_loadlists_checker_employee
FOREIGN KEY (checker_employee_id)
REFERENCES public.master_employee(employee_id)
ON DELETE SET NULL;

-- ============================================================
-- PART 3: Add Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_loadlists_loading_door
ON public.loadlists(loading_door_number);

CREATE INDEX IF NOT EXISTS idx_loadlists_loading_queue
ON public.loadlists(loading_queue_number);

CREATE INDEX IF NOT EXISTS idx_loadlists_checker_employee
ON public.loadlists(checker_employee_id);

CREATE INDEX IF NOT EXISTS idx_loadlists_delivery_number
ON public.loadlists(delivery_number);

-- ============================================================
-- PART 4: Add Comments
-- ============================================================

COMMENT ON COLUMN public.loadlists.loading_door_number IS 'ประตูโหลดสินค้า (Loading Door)';
COMMENT ON COLUMN public.loadlists.loading_queue_number IS 'คิวลำดับการโหลด';
COMMENT ON COLUMN public.loadlists.checker_employee_id IS 'พนักงานผู้เช็คการโหลดสินค้า (FK to master_employee)';
COMMENT ON COLUMN public.loadlists.vehicle_type IS 'ประเภทรถที่ใช้ขนส่ง';
COMMENT ON COLUMN public.loadlists.delivery_number IS 'เลขงานจัดส่ง (Delivery Order Number)';

-- ============================================================
-- Migration Summary
-- ============================================================
-- 1. ✅ เพิ่มคอลัมน์ loading_door_number (ประตูโหลด)
-- 2. ✅ เพิ่มคอลัมน์ loading_queue_number (คิวลำดับ)
-- 3. ✅ เพิ่มคอลัมน์ checker_employee_id (ผู้เช็คโหลด)
-- 4. ✅ เพิ่มคอลัมน์ vehicle_type (ประเภทรถ)
-- 5. ✅ เพิ่มคอลัมน์ delivery_number (เลขงานจัดส่ง)
-- 6. ✅ เพิ่ม Foreign Key สำหรับ checker_employee_id
-- 7. ✅ สร้าง Indexes สำหรับ query performance
-- 8. ✅ เพิ่ม Comments ภาษาไทย

-- Usage Example:
-- UPDATE loadlists SET
--   loading_door_number = 'D-01',
--   loading_queue_number = 'Q-001',
--   checker_employee_id = 123,
--   vehicle_type = 'รถ 6 ล้อ',
--   delivery_number = 'S002855'
-- WHERE id = 1;

-- ============================================================
-- Migration 038: Create wms_loadlist_picklists junction table
-- ============================================================
-- สร้างตารางเชื่อมระหว่าง loadlists และ picklists
-- เพื่อให้ 1 loadlist สามารถมีหลาย picklists ได้
-- Date: 2025-11-26

-- ============================================================
-- PART 1: Create wms_loadlist_picklists table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wms_loadlist_picklists (
    id BIGSERIAL PRIMARY KEY,
    loadlist_id BIGINT NOT NULL,
    picklist_id BIGINT NOT NULL,
    sequence INTEGER DEFAULT 1,
    loaded_at TIMESTAMPTZ,
    loaded_by_employee_id BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT wms_loadlist_picklists_unique UNIQUE (loadlist_id, picklist_id),
    CONSTRAINT wms_loadlist_picklists_sequence_check CHECK (sequence > 0)
);

-- ============================================================
-- PART 2: Add Foreign Keys
-- ============================================================

-- FK to loadlists
ALTER TABLE public.wms_loadlist_picklists
    ADD CONSTRAINT fk_wms_loadlist_picklists_loadlist
    FOREIGN KEY (loadlist_id)
    REFERENCES public.loadlists(id)
    ON DELETE CASCADE;

-- FK to picklists
ALTER TABLE public.wms_loadlist_picklists
    ADD CONSTRAINT fk_wms_loadlist_picklists_picklist
    FOREIGN KEY (picklist_id)
    REFERENCES public.picklists(id)
    ON DELETE CASCADE;

-- FK to employee (optional)
ALTER TABLE public.wms_loadlist_picklists
    ADD CONSTRAINT fk_wms_loadlist_picklists_employee
    FOREIGN KEY (loaded_by_employee_id)
    REFERENCES public.master_employee(employee_id)
    ON DELETE SET NULL;

-- ============================================================
-- PART 3: Create Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wms_loadlist_picklists_loadlist_id
    ON public.wms_loadlist_picklists(loadlist_id);

CREATE INDEX IF NOT EXISTS idx_wms_loadlist_picklists_picklist_id
    ON public.wms_loadlist_picklists(picklist_id);

CREATE INDEX IF NOT EXISTS idx_wms_loadlist_picklists_created_at
    ON public.wms_loadlist_picklists(created_at DESC);

-- ============================================================
-- PART 4: Enable RLS
-- ============================================================

ALTER TABLE public.wms_loadlist_picklists ENABLE ROW LEVEL SECURITY;

-- Policy 1: อนุญาตให้ authenticated users อ่านได้ทั้งหมด
CREATE POLICY "Enable read access for authenticated users"
ON public.wms_loadlist_picklists
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: อนุญาตให้ authenticated users สร้างได้
CREATE POLICY "Enable insert for authenticated users"
ON public.wms_loadlist_picklists
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: อนุญาตให้ authenticated users แก้ไขได้
CREATE POLICY "Enable update for authenticated users"
ON public.wms_loadlist_picklists
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: อนุญาตให้ authenticated users ลบได้
CREATE POLICY "Enable delete for authenticated users"
ON public.wms_loadlist_picklists
FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- PART 5: Create Updated_at Trigger
-- ============================================================

-- ใช้ function ที่มีอยู่แล้วจาก migration 028
DROP TRIGGER IF EXISTS update_wms_loadlist_picklists_updated_at ON public.wms_loadlist_picklists;

CREATE TRIGGER update_wms_loadlist_picklists_updated_at
    BEFORE UPDATE ON public.wms_loadlist_picklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 6: Add Comments
-- ============================================================

COMMENT ON TABLE public.wms_loadlist_picklists IS 'ตารางเชื่อมระหว่าง loadlists และ picklists (junction table)';
COMMENT ON COLUMN public.wms_loadlist_picklists.loadlist_id IS 'รหัส loadlist (FK to loadlists.id)';
COMMENT ON COLUMN public.wms_loadlist_picklists.picklist_id IS 'รหัส picklist (FK to picklists.id)';
COMMENT ON COLUMN public.wms_loadlist_picklists.sequence IS 'ลำดับการโหลด picklist นี้ในใบโหลด';
COMMENT ON COLUMN public.wms_loadlist_picklists.loaded_at IS 'วันเวลาที่โหลดเสร็จ';
COMMENT ON COLUMN public.wms_loadlist_picklists.loaded_by_employee_id IS 'พนักงานที่โหลด (FK to master_employee)';

-- ============================================================
-- Migration Summary
-- ============================================================
-- 1. ✅ สร้างตาราง wms_loadlist_picklists
-- 2. ✅ เพิ่ม Foreign Keys (loadlist, picklist, employee)
-- 3. ✅ สร้าง Indexes (loadlist_id, picklist_id, created_at)
-- 4. ✅ เปิด RLS พร้อม 4 policies
-- 5. ✅ สร้าง updated_at trigger
-- 6. ✅ เพิ่ม Comments

-- Usage Example:
-- INSERT INTO wms_loadlist_picklists (loadlist_id, picklist_id, sequence)
-- VALUES (1, 101, 1), (1, 102, 2), (1, 103, 3);

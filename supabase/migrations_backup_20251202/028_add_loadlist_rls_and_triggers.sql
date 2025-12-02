-- ============================================================
-- Migration 028: Add RLS Policies and Updated_at Triggers
-- ============================================================
-- เพิ่ม RLS Policies และ updated_at triggers สำหรับ loadlists และ loadlist_items
-- ตามคำแนะนำจากการตรวจสอบระบบ

-- ============================================================
-- PART 1: RLS Policies for loadlists
-- ============================================================

-- Enable RLS (already enabled, but just to be sure)
ALTER TABLE loadlists ENABLE ROW LEVEL SECURITY;

-- Policy 1: อนุญาตให้ authenticated users อ่านได้ทั้งหมด
CREATE POLICY "Enable read access for authenticated users"
ON loadlists
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: อนุญาตให้ authenticated users สร้างได้
CREATE POLICY "Enable insert for authenticated users"
ON loadlists
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: อนุญาตให้ authenticated users แก้ไขได้
CREATE POLICY "Enable update for authenticated users"
ON loadlists
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: อนุญาตให้ authenticated users ลบได้ (soft delete - เปลี่ยนสถานะเป็น cancelled)
CREATE POLICY "Enable delete for authenticated users"
ON loadlists
FOR DELETE
TO authenticated
USING (true);

COMMENT ON POLICY "Enable read access for authenticated users" ON loadlists IS 'อนุญาตให้ authenticated users อ่าน loadlists ทั้งหมด';
COMMENT ON POLICY "Enable insert for authenticated users" ON loadlists IS 'อนุญาตให้ authenticated users สร้าง loadlist ใหม่';
COMMENT ON POLICY "Enable update for authenticated users" ON loadlists IS 'อนุญาตให้ authenticated users แก้ไข loadlist';
COMMENT ON POLICY "Enable delete for authenticated users" ON loadlists IS 'อนุญาตให้ authenticated users ลบ loadlist';

-- ============================================================
-- PART 2: RLS Policies for loadlist_items
-- ============================================================

-- Enable RLS (already enabled, but just to be sure)
ALTER TABLE loadlist_items ENABLE ROW LEVEL SECURITY;

-- Policy 1: อนุญาตให้ authenticated users อ่านได้ทั้งหมด
CREATE POLICY "Enable read access for authenticated users"
ON loadlist_items
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: อนุญาตให้ authenticated users สร้างได้
CREATE POLICY "Enable insert for authenticated users"
ON loadlist_items
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: อนุญาตให้ authenticated users แก้ไขได้
CREATE POLICY "Enable update for authenticated users"
ON loadlist_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: อนุญาตให้ authenticated users ลบได้
CREATE POLICY "Enable delete for authenticated users"
ON loadlist_items
FOR DELETE
TO authenticated
USING (true);

COMMENT ON POLICY "Enable read access for authenticated users" ON loadlist_items IS 'อนุญาตให้ authenticated users อ่าน loadlist items ทั้งหมด';
COMMENT ON POLICY "Enable insert for authenticated users" ON loadlist_items IS 'อนุญาตให้ authenticated users เพิ่ม item เข้า loadlist';
COMMENT ON POLICY "Enable update for authenticated users" ON loadlist_items IS 'อนุญาตให้ authenticated users แก้ไข loadlist item';
COMMENT ON POLICY "Enable delete for authenticated users" ON loadlist_items IS 'อนุญาตให้ authenticated users ลบ loadlist item';

-- ============================================================
-- PART 3: Updated_at Triggers
-- ============================================================

-- ตรวจสอบว่ามี function update_updated_at_column() หรือไม่
-- ถ้ามีอยู่แล้ว ก็ไม่ต้องสร้างใหม่
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.routines
        WHERE routine_name = 'update_updated_at_column'
        AND routine_schema = 'public'
    ) THEN
        -- สร้าง function สำหรับอัปเดต updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        COMMENT ON FUNCTION update_updated_at_column() IS 'อัปเดต updated_at column อัตโนมัติเมื่อมีการ UPDATE';
    END IF;
END $$;

-- Trigger สำหรับ loadlists
DROP TRIGGER IF EXISTS update_loadlists_updated_at ON loadlists;
CREATE TRIGGER update_loadlists_updated_at
    BEFORE UPDATE ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_loadlists_updated_at ON loadlists IS 'อัปเดต updated_at อัตโนมัติเมื่อมีการแก้ไข loadlist';

-- Trigger สำหรับ loadlist_items
DROP TRIGGER IF EXISTS update_loadlist_items_updated_at ON loadlist_items;
CREATE TRIGGER update_loadlist_items_updated_at
    BEFORE UPDATE ON loadlist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_loadlist_items_updated_at ON loadlist_items IS 'อัปเดต updated_at อัตโนมัติเมื่อมีการแก้ไข loadlist item';

-- ============================================================
-- สรุปการสร้าง
-- ============================================================

-- Migration Summary:
-- 1. ✅ RLS Policies สำหรับ loadlists (4 policies: SELECT, INSERT, UPDATE, DELETE)
-- 2. ✅ RLS Policies สำหรับ loadlist_items (4 policies: SELECT, INSERT, UPDATE, DELETE)
-- 3. ✅ Updated_at Trigger สำหรับ loadlists
-- 4. ✅ Updated_at Trigger สำหรับ loadlist_items

-- Notes:
-- - RLS Policies อนุญาตให้ authenticated users เข้าถึงได้ทั้งหมด
-- - ถ้าต้องการควบคุมการเข้าถึงแบบละเอียด (เช่น แยกตาม warehouse, role)
--   สามารถแก้ไข policies เพิ่มเติมได้ในภายหลัง
-- - Updated_at triggers จะอัปเดต timestamp อัตโนมัติเมื่อมีการแก้ไขข้อมูล

-- Migration: Simplify loadlist status enum
-- ลดสถานะเหลือแค่ 3 สถานะ: pending, loaded, cancelled
-- เดิมมี 5 สถานะ: pending, loading, loaded, completed, cancelled

-- 1. ลบ default constraint ชั่วคราว
ALTER TABLE loadlists
  ALTER COLUMN status DROP DEFAULT;

-- 2. สร้าง enum ใหม่ที่มีแค่ 3 สถานะ
CREATE TYPE loadlist_status_enum_new AS ENUM ('pending', 'loaded', 'cancelled');

-- 3. เปลี่ยน column ให้ใช้ enum ใหม่ พร้อม map ค่าเก่า
-- loading, completed → loaded
-- pending, cancelled → ยังคงเดิม
ALTER TABLE loadlists
  ALTER COLUMN status TYPE loadlist_status_enum_new
  USING (
    CASE status::text
      WHEN 'loading' THEN 'loaded'::loadlist_status_enum_new
      WHEN 'completed' THEN 'loaded'::loadlist_status_enum_new
      WHEN 'pending' THEN 'pending'::loadlist_status_enum_new
      WHEN 'cancelled' THEN 'cancelled'::loadlist_status_enum_new
      ELSE 'pending'::loadlist_status_enum_new
    END
  );

-- 4. ลบ enum เก่า
DROP TYPE loadlist_status_enum;

-- 5. เปลี่ยนชื่อ enum ใหม่เป็นชื่อเดิม
ALTER TYPE loadlist_status_enum_new RENAME TO loadlist_status_enum;

-- 6. ตั้ง default ใหม่
ALTER TABLE loadlists
  ALTER COLUMN status SET DEFAULT 'pending'::loadlist_status_enum;

-- 7. เพิ่ม comment อธิบายสถานะ
COMMENT ON TYPE loadlist_status_enum IS 'Loadlist status: pending (รอโหลด), loaded (โหลดเสร็จ), cancelled (ยกเลิก)';

-- 8. ตรวจสอบผลลัพธ์
SELECT
  'Loadlist Status Summary' as info,
  status::text,
  COUNT(*) as count
FROM loadlists
GROUP BY status
ORDER BY status;

-- ============================================================
-- Migration: 111_fix_tester_cnt_preparation_area.sql
-- Description: อัปเดต default_location สำหรับ TT-NET-C|CNT|0005
-- Date: 2025-12-06
-- ============================================================
-- แก้ไข SKU ที่ไม่สำเร็จใน migration 109 (ตอนนั้นยังไม่มี SKU นี้)
-- ตอนนี้ SKU ถูกสร้างแล้วใน migration 110 จึงสามารถอัปเดตได้
-- ============================================================

-- อัปเดต default_location สำหรับ TT-NET-C|CNT|0005
UPDATE master_sku
SET 
  default_location = 'A10-01-022',
  updated_at = CURRENT_TIMESTAMP
WHERE sku_id = 'TT-NET-C|CNT|0005';

-- ตรวจสอบผลลัพธ์
SELECT 
  sku_id,
  sku_name,
  category,
  brand,
  default_location,
  updated_at
FROM master_sku
WHERE sku_id = 'TT-NET-C|CNT|0005';

-- Log
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM master_sku
  WHERE sku_id = 'TT-NET-C|CNT|0005' 
    AND default_location = 'A10-01-022';
  
  IF updated_count > 0 THEN
    RAISE NOTICE 'Migration 111: Successfully updated default_location for TT-NET-C|CNT|0005 to A10-01-022';
  ELSE
    RAISE WARNING 'Migration 111: SKU TT-NET-C|CNT|0005 not found or update failed';
  END IF;
END $$;

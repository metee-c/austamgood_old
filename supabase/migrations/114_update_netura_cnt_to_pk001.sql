-- ============================================================
-- SQL Script: อัปเดต default_location สำหรับ Netura CNT SKU
-- วันที่: 2025-12-06
-- คำอธิบาย: เปลี่ยน default_location จาก PK001 เป็นโลเคชั่นเฉพาะ
--           สำหรับ SKU 2 รายการ:
--           - B-NET-C|CNT|010 (1 กก.)
--           - B-NET-C|CNT|040 (4 กก.)
-- ============================================================

BEGIN;

-- อัปเดต default_location สำหรับ 2 SKU
UPDATE master_sku
SET 
  default_location = 'PK001',
  updated_at = CURRENT_TIMESTAMP
WHERE sku_id IN (
  'B-NET-C|CNT|010',
  'B-NET-C|CNT|040'
);

-- แสดงผลลัพธ์
SELECT 
  sku_id,
  sku_name,
  category,
  brand,
  default_location,
  updated_at
FROM master_sku
WHERE sku_id IN (
  'B-NET-C|CNT|010',
  'B-NET-C|CNT|040'
)
ORDER BY sku_id;

COMMIT;

-- ============================================================
-- สรุปผลลัพธ์
-- ============================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM master_sku
  WHERE sku_id IN ('B-NET-C|CNT|010', 'B-NET-C|CNT|040')
    AND default_location = 'PK001';
  
  RAISE NOTICE 'Updated % SKU(s) to use PK001 as default_location', updated_count;
END $$;

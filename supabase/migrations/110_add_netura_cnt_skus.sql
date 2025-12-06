-- ============================================================
-- Migration: 110_add_netura_cnt_skus.sql
-- Description: เพิ่ม SKU ใหม่สำหรับ Buzz Netura CNT (Cod & Trout)
-- Date: 2025-12-06
-- ============================================================
-- เพิ่ม SKU ทั้งหมด 7 รายการ:
-- 1. B-NET-C|CNT|010 - สินค้าสำเร็จรูป 1 กก.
-- 2. B-NET-C|CNT|040 - สินค้าสำเร็จรูป 4 กก.
-- 3. 00-NET-C|CNT|200 - วัตถุดิบ 20 กก.
-- 4. 01-NET-C|CNT|010 - ถุงบรรจุภัณฑ์ 1 กก.
-- 5. 01-NET-C|CNT|040 - ถุงบรรจุภัณฑ์ 4 กก.
-- 6. 02-NET-C|CNT|0005 - สติ๊กเกอร์ Tester
-- 7. TT-NET-C|CNT|0005 - สินค้าทดสอบ 50 กรัม
-- ============================================================

-- เพิ่ม SKU ใหม่
INSERT INTO master_sku (
  sku_id,
  sku_name,
  category,
  sub_category,
  brand,
  product_type,
  uom_base,
  qty_per_pack,
  qty_per_pallet,
  weight_per_piece_kg,
  barcode,
  status,
  default_location,
  created_by,
  created_at,
  updated_at
) VALUES
  -- 1. สินค้าสำเร็จรูป 1 กก.
  (
    'B-NET-C|CNT|010',
    'Buzz Netura แมวเลี้ยงในบ้าน และแมวทำหมัน ปลาค๊อด & ปลาเทราต์ | 1 กก.',
    'สินค้าสำเร็จรูป',
    'อาหารแมว',
    'Buzz Netura',
    'ชนิดแห้งแบบเม็ด',
    'ถุง',
    12,  -- 12 ถุง/แพ็ค
    576, -- 48 แพ็ค/พาเลท × 12 = 576 ถุง
    1.000,
    '5424052514103',
    'active',
    'PK001', -- ยังไม่ได้กำหนดโลเคชั่นเฉพาะ
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 2. สินค้าสำเร็จรูป 4 กก.
  (
    'B-NET-C|CNT|040',
    'Buzz Netura แมวเลี้ยงในบ้าน และแมวทำหมัน ปลาค๊อด & ปลาเทราต์ | 4 กก.',
    'สินค้าสำเร็จรูป',
    'อาหารแมว',
    'Buzz Netura',
    'ชนิดแห้งแบบเม็ด',
    'ถุง',
    4,   -- 4 ถุง/แพ็ค
    200, -- 50 แพ็ค/พาเลท × 4 = 200 ถุง
    4.000,
    '5424052514400',
    'active',
    'PK001',
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 3. วัตถุดิบ 20 กก.
  (
    '00-NET-C|CNT|200',
    'อาหาร | Buzz Netura แมวโตและแมวสูงวัย 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 20 กก.',
    'วัตถุดิบ',
    'อาหารแมว',
    'Buzz Netura',
    'ชนิดแห้งแบบเม็ด',
    'ถุง',
    1,   -- 1 ถุง/แพ็ค
    84,  -- 84 ถุง/พาเลท (7 Ti × 12 Hi)
    20.000,
    NULL,
    'active',
    NULL,
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 4. ถุงบรรจุภัณฑ์ 1 กก.
  (
    '01-NET-C|CNT|010',
    'ถุง | Buzz Netura แมวโตและแมวสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 1 กก.',
    'ถุงบรรจุภัณฑ์',
    NULL,
    NULL,
    NULL,
    'ใบ',
    1,
    NULL,
    NULL,
    NULL,
    'active',
    NULL,
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 5. ถุงบรรจุภัณฑ์ 4 กก.
  (
    '01-NET-C|CNT|040',
    'ถุง | Buzz Netura แมวโตและแมวสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 4 กก.',
    'ถุงบรรจุภัณฑ์',
    NULL,
    NULL,
    NULL,
    'ใบ',
    1,
    NULL,
    NULL,
    NULL,
    'active',
    NULL,
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 6. สติ๊กเกอร์ Tester
  (
    '02-NET-C|CNT|0005',
    'สติ๊กเกอร์ Tester | Buzz Netura แมวโตและสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 50 กรัม',
    'สติ๊กเกอร์',
    NULL,
    NULL,
    NULL,
    'แผ่น',
    1,
    NULL,
    NULL,
    NULL,
    'active',
    NULL,
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  
  -- 7. สินค้าทดสอบ 50 กรัม
  (
    'TT-NET-C|CNT|0005',
    'Tester | Buzz Netura แมวโตและสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 50 กรัม',
    'สินค้าทดสอบ',
    'อาหารแมว',
    'Buzz Netura',
    'ชนิดแห้งแบบเม็ด',
    'ถุง',
    50,  -- 50 ถุง/แพ็ค
    NULL,
    0.050,
    NULL,
    'active',
    'A10-01-022', -- กำหนดโลเคชั่นบ้านหยิบตามข้อมูลเดิม
    'system',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (sku_id) DO UPDATE SET
  sku_name = EXCLUDED.sku_name,
  category = EXCLUDED.category,
  sub_category = EXCLUDED.sub_category,
  brand = EXCLUDED.brand,
  product_type = EXCLUDED.product_type,
  uom_base = EXCLUDED.uom_base,
  qty_per_pack = EXCLUDED.qty_per_pack,
  qty_per_pallet = EXCLUDED.qty_per_pallet,
  weight_per_piece_kg = EXCLUDED.weight_per_piece_kg,
  barcode = EXCLUDED.barcode,
  status = EXCLUDED.status,
  default_location = EXCLUDED.default_location,
  updated_at = CURRENT_TIMESTAMP;

-- Log: แสดงผลลัพธ์
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM master_sku
  WHERE sku_id IN (
    'B-NET-C|CNT|010',
    'B-NET-C|CNT|040',
    '00-NET-C|CNT|200',
    '01-NET-C|CNT|010',
    '01-NET-C|CNT|040',
    '02-NET-C|CNT|0005',
    'TT-NET-C|CNT|0005'
  );
  
  RAISE NOTICE 'Migration 110: Added/Updated % Netura CNT SKUs', inserted_count;
END $$;

-- ตรวจสอบผลลัพธ์
SELECT 
  sku_id,
  sku_name,
  category,
  brand,
  uom_base,
  qty_per_pack,
  weight_per_piece_kg,
  barcode,
  default_location
FROM master_sku
WHERE sku_id LIKE '%NET-C|CNT%'
ORDER BY 
  CASE 
    WHEN sku_id LIKE 'B-%' THEN 1
    WHEN sku_id LIKE 'TT-%' THEN 2
    WHEN sku_id LIKE '00-%' THEN 3
    WHEN sku_id LIKE '01-%' THEN 4
    WHEN sku_id LIKE '02-%' THEN 5
  END,
  sku_id;

-- ============================================================================
-- SQL Script: สร้างพาเลทไอดีให้สินค้าพรีเมี่ยม (PRE-*) ที่ไม่มีพาเลทไอดี
-- ============================================================================

-- 1. ตรวจสอบสินค้าพรีเมี่ยมที่ไม่มีพาเลทไอดีก่อนแก้ไข
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT s.sku_id) as unique_skus,
  SUM(b.total_piece_qty) as total_pieces
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
WHERE b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%';

-- 2. แสดงรายการสินค้าพรีเมี่ยมที่จะได้รับพาเลทไอดีใหม่
SELECT 
  b.balance_id,
  s.sku_id,
  s.sku_name,
  l.location_code,
  b.total_piece_qty,
  'PREM' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(b.balance_id::TEXT, 9, '0') as new_pallet_id
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%'
ORDER BY s.sku_id, b.balance_id
LIMIT 20;

-- 3. สร้างพาเลทไอดีใหม่สำหรับสินค้าพรีเมี่ยมทั้งหมด
-- รูปแบบ: PREM + YYYYMMDD + balance_id (9 หลัก)
-- ตัวอย่าง: PREM20260123000029064

UPDATE wms_inventory_balances b
SET 
  pallet_id = 'PREM' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(b.balance_id::TEXT, 9, '0'),
  updated_at = NOW()
FROM master_sku s
WHERE b.sku_id = s.sku_id
  AND b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%';

-- 4. ตรวจสอบผลลัพธ์หลังแก้ไข
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT s.sku_id) as unique_skus,
  SUM(CASE WHEN b.pallet_id IS NULL THEN 1 ELSE 0 END) as still_no_pallet,
  SUM(CASE WHEN b.pallet_id IS NOT NULL THEN 1 ELSE 0 END) as has_pallet
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
WHERE b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%';

-- 5. แสดงตัวอย่างสินค้าพรีเมี่ยมที่ได้รับพาเลทไอดีใหม่
SELECT 
  b.balance_id,
  s.sku_id,
  s.sku_name,
  l.location_code,
  b.pallet_id,
  b.total_piece_qty,
  b.updated_at
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%'
  AND b.pallet_id LIKE 'PREM%'
ORDER BY b.updated_at DESC
LIMIT 20;

-- ============================================================================
-- หมายเหตุ:
-- 1. Query 1-2: ตรวจสอบข้อมูลก่อนแก้ไข
-- 2. Query 3: แก้ไขจริง - สร้างพาเลทไอดีใหม่
-- 3. Query 4-5: ตรวจสอบผลลัพธ์หลังแก้ไข
-- 
-- คำเตือน:
-- - Query 3 จะแก้ไขข้อมูลในฐานข้อมูล
-- - ควร backup ข้อมูลก่อนรัน Query 3
-- - ควรรัน Query 1-2 เพื่อตรวจสอบก่อน
-- ============================================================================

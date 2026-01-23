-- ============================================================================
-- SQL Script: แยกและอัปเดตพาเลทไอดีสินค้าพรีเมี่ยมที่ MCF-*
-- ============================================================================

-- ปัญหา: ระบบรวมยอดจาก 7 พาเลทเป็น 1 แถว (140 ชิ้น)
-- วิธีแก้: ลบแถวเดิม แล้วสร้างแถวใหม่ 7 แถว (แถวละ 20 ชิ้น) พร้อมพาเลทไอดีที่ถูกต้อง

-- 1. ตรวจสอบข้อมูลปัจจุบัน
SELECT 
  balance_id,
  sku_id,
  location_id,
  pallet_id,
  total_piece_qty,
  production_date,
  expiry_date
FROM wms_inventory_balances
WHERE sku_id = 'PRE-BAG|CAV|CM|R' 
  AND location_id = 'MCF-AB02';

-- 2. ลบแถวเดิมที่รวมยอด (140 ชิ้น)
DELETE FROM wms_inventory_balances
WHERE sku_id = 'PRE-BAG|CAV|CM|R' 
  AND location_id = 'MCF-AB02'
  AND total_piece_qty = 140
  AND pallet_id IS NULL;

-- 3. สร้างแถวใหม่ 7 แถว พร้อมพาเลทไอดีที่ถูกต้อง
INSERT INTO wms_inventory_balances (
  warehouse_id, location_id, sku_id, pallet_id,
  production_date, expiry_date,
  total_pack_qty, total_piece_qty,
  reserved_pack_qty, reserved_piece_qty,
  last_movement_at, created_at, updated_at
) VALUES
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017272', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017271', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017270', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017269', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017268', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017266', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW()),
  ('WH01', 'MCF-AB02', 'PRE-BAG|CAV|CM|R', 'ATG2500017265', '2025-12-01', '2026-12-01', 1, 20, 0, 0, '2025-12-15 17:00:00+00', NOW(), NOW());

-- 4. อัปเดตพาเลทไอดีสำหรับเสื้อยืด Protein X ที่ MCF-AB04 (ไม่ต้องแยก)
UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015289', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-3XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 17;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015288', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-2XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 23;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015287', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015286', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-L|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 21;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015285', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-M|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 35;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015284', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-S|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015283', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-3XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 19;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015282', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-2XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015281', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 40;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015280', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-L' AND location_id = 'MCF-AB04' AND total_piece_qty = 9;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015279', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-M' AND location_id = 'MCF-AB04' AND total_piece_qty = 6;

UPDATE wms_inventory_balances SET pallet_id = 'ATG2500015278', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-S' AND location_id = 'MCF-AB04' AND total_piece_qty = 16;

-- 5. ตรวจสอบผลลัพธ์
SELECT 
  b.balance_id,
  s.sku_id,
  s.sku_name,
  l.location_code,
  b.pallet_id,
  b.total_piece_qty,
  b.production_date,
  b.expiry_date
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE s.sku_id LIKE 'PRE-%'
  AND l.location_code LIKE 'MCF-%'
ORDER BY l.location_code, s.sku_id, b.pallet_id;

-- ============================================================================
-- คำเตือน:
-- - Query 2 จะลบแถวเดิม (140 ชิ้น)
-- - Query 3 จะสร้างแถวใหม่ 7 แถว (แถวละ 20 ชิ้น)
-- - ควร backup ข้อมูลก่อนรัน
-- ============================================================================

-- ============================================================================
-- SQL Script: สร้างพาเลทไอดีให้สินค้าพรีเมี่ยม (PRE-*) ที่อยู่โลเคชั่น MCF-*
-- ============================================================================

-- 1. ตรวจสอบสินค้าพรีเมี่ยมที่โลเคชั่น MCF-* ที่ไม่มีพาเลทไอดี
SELECT 
  b.balance_id,
  s.sku_id,
  s.sku_name,
  l.location_code,
  l.location_name,
  b.total_piece_qty,
  b.production_date,
  b.expiry_date
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%'
  AND l.location_code LIKE 'MCF-%'
ORDER BY s.sku_id;

-- สรุป: พบ 13 รายการ
-- - MCF-AB02: 1 รายการ (กระเป๋าผ้า Christmas)
-- - MCF-AB04: 12 รายการ (เสื้อยืด Protein X ทุกไซส์)

-- 2. สร้างพาเลทไอดีใหม่สำหรับสินค้าพรีเมี่ยมที่โลเคชั่น MCF-*
-- รูปแบบ: PREM + YYYYMMDD + balance_id (9 หลัก)
-- ตัวอย่าง: PREM20260123000027637

UPDATE wms_inventory_balances b
SET 
  pallet_id = 'PREM' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(b.balance_id::TEXT, 9, '0'),
  updated_at = NOW()
FROM master_sku s, master_location l
WHERE b.sku_id = s.sku_id
  AND b.location_id = l.location_id
  AND b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%'
  AND l.location_code LIKE 'MCF-%';

-- 3. ตรวจสอบผลลัพธ์หลังแก้ไข
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
  AND l.location_code LIKE 'MCF-%'
  AND b.pallet_id LIKE 'PREM%'
ORDER BY s.sku_id;

-- 4. สรุปสถิติ
SELECT 
  l.location_code,
  COUNT(*) as total_items,
  SUM(b.total_piece_qty) as total_pieces,
  COUNT(CASE WHEN b.pallet_id IS NULL THEN 1 END) as no_pallet,
  COUNT(CASE WHEN b.pallet_id IS NOT NULL THEN 1 END) as has_pallet
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE b.total_piece_qty > 0
  AND s.sku_id LIKE 'PRE-%'
  AND l.location_code LIKE 'MCF-%'
GROUP BY l.location_code
ORDER BY l.location_code;

-- ============================================================================
-- รายการสินค้าที่จะได้รับพาเลทไอดีใหม่:
-- 
-- MCF-AB02 (1 รายการ):
-- - PRE-BAG|CAV|CM|R - กระเป๋าผ้า Christmas 24 สะพายสีแดง (140 ชิ้น)
--
-- MCF-AB04 (12 รายการ):
-- - PRE-TSH|PX|NB-2XL - เสื้อยืด Protein X 2XL (15 ชิ้น)
-- - PRE-TSH|PX|NB-2XL|B - เสื้อยืด Protein X 2XL สกรีนหลัง (23 ชิ้น)
-- - PRE-TSH|PX|NB-3XL - เสื้อยืด Protein X 3XL (19 ชิ้น)
-- - PRE-TSH|PX|NB-3XL|B - เสื้อยืด Protein X 3XL สกรีนหลัง (17 ชิ้น)
-- - PRE-TSH|PX|NB-L - เสื้อยืด Protein X L (9 ชิ้น)
-- - PRE-TSH|PX|NB-L|B - เสื้อยืด Protein X L สกรีนหลัง (21 ชิ้น)
-- - PRE-TSH|PX|NB-M - เสื้อยืด Protein X M (6 ชิ้น)
-- - PRE-TSH|PX|NB-M|B - เสื้อยืด Protein X M สกรีนหลัง (35 ชิ้น)
-- - PRE-TSH|PX|NB-S - เสื้อยืด Protein X S (16 ชิ้น)
-- - PRE-TSH|PX|NB-S|B - เสื้อยืด Protein X S สกรีนหลัง (15 ชิ้น)
-- - PRE-TSH|PX|NB-XL - เสื้อยืด Protein X XL (40 ชิ้น)
-- - PRE-TSH|PX|NB-XL|B - เสื้อยืด Protein X XL สกรีนหลัง (15 ชิ้น)
--
-- รวม: 13 รายการ, 371 ชิ้น
-- ============================================================================

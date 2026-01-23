-- ============================================================================
-- SQL Script: อัปเดตพาเลทไอดีสินค้าพรีเมี่ยมที่ MCF-* ตามข้อมูลจริงจากไฟล์นำเข้า
-- ============================================================================

-- อัปเดตพาเลทไอดีสำหรับสินค้าพรีเมี่ยมที่ MCF-AB02
-- กระเป๋าผ้า Christmas 24 สะพายสีแดง (140 ชิ้น รวม 7 พาเลท)

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017272', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017271', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017270', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017269', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017268', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017266', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500017265', updated_at = NOW()
WHERE sku_id = 'PRE-BAG|CAV|CM|R' AND location_id = 'MCF-AB02' AND total_piece_qty = 20 AND pallet_id IS NULL
LIMIT 1;

-- อัปเดตพาเลทไอดีสำหรับเสื้อยืด Protein X ที่ MCF-AB04

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015289', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-3XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 17;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015288', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-2XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 23;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015287', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-XL|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015286', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-L|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 21;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015285', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-M|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 35;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015284', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-S|B' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015283', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-3XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 19;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015282', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-2XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 15;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015281', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-XL' AND location_id = 'MCF-AB04' AND total_piece_qty = 40;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015280', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-L' AND location_id = 'MCF-AB04' AND total_piece_qty = 9;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015279', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-M' AND location_id = 'MCF-AB04' AND total_piece_qty = 6;

UPDATE wms_inventory_balances
SET pallet_id = 'ATG2500015278', updated_at = NOW()
WHERE sku_id = 'PRE-TSH|PX|NB-S' AND location_id = 'MCF-AB04' AND total_piece_qty = 16;

-- ตรวจสอบผลลัพธ์
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
WHERE s.sku_id LIKE 'PRE-%'
  AND l.location_code LIKE 'MCF-%'
  AND b.pallet_id LIKE 'ATG25%'
ORDER BY s.sku_id, b.pallet_id;

-- ============================================================================
-- สรุป:
-- - MCF-AB02: 7 พาเลท (กระเป๋าผ้า Christmas)
-- - MCF-AB04: 12 พาเลท (เสื้อยืด Protein X)
-- รวม: 19 พาเลท
-- ============================================================================

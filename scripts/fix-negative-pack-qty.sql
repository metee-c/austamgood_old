-- ============================================================
-- Script: fix-negative-pack-qty.sql
-- Description: แก้ไข wms_inventory_balances ที่มี total_pack_qty ติดลบ
-- Date: 2026-01-21
-- ============================================================

-- Step 1: ดูข้อมูลก่อนแก้ไข
SELECT
  balance_id,
  sku_id,
  location_id,
  pallet_id,
  total_piece_qty,
  total_pack_qty,
  CASE
    WHEN pallet_id LIKE 'VIRTUAL-%' THEN 'virtual'
    WHEN location_id = 'Packaging' THEN 'packaging'
    ELSE 'normal'
  END as balance_type
FROM wms_inventory_balances
WHERE total_pack_qty < 0 OR total_piece_qty < 0
ORDER BY location_id, sku_id;

-- Step 2: สำหรับ VIRTUAL pallets - ลบออกเพราะเป็น virtual debt
-- (ถ้าต้องการเก็บไว้ ให้ comment บรรทัดนี้)
DELETE FROM wms_inventory_balances
WHERE pallet_id LIKE 'VIRTUAL-%'
  AND (total_piece_qty < 0 OR total_pack_qty < 0);

-- Step 3: สำหรับ balance ปกติที่มี total_piece_qty > 0 แต่ total_pack_qty < 0
-- คำนวณ pack_qty ใหม่จาก piece_qty / qty_per_pack
UPDATE wms_inventory_balances ib
SET total_pack_qty = CEIL(ib.total_piece_qty / GREATEST(COALESCE(ms.qty_per_pack, 1), 1))
FROM master_sku ms
WHERE ib.sku_id = ms.sku_id
  AND ib.total_piece_qty > 0
  AND ib.total_pack_qty < 0;

-- Step 4: สำหรับ balance ที่มี total_piece_qty <= 0 และ total_pack_qty < 0
-- ลบออกเพราะไม่มีค่า
DELETE FROM wms_inventory_balances
WHERE total_piece_qty <= 0 AND total_pack_qty < 0;

-- Step 5: ตรวจสอบผลลัพธ์
SELECT
  balance_id,
  sku_id,
  location_id,
  pallet_id,
  total_piece_qty,
  total_pack_qty
FROM wms_inventory_balances
WHERE total_pack_qty < 0 OR total_piece_qty < 0
ORDER BY location_id, sku_id;

-- ถ้าไม่มีผลลัพธ์ = สำเร็จ!

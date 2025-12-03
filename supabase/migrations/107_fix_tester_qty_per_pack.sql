-- Migration: 107_fix_tester_qty_per_pack.sql
-- Description: แก้ไข qty_per_pack ของสินค้า Tester จาก 1 เป็น 50
-- Date: 2025-12-03
-- Reason: 1 แพ็ค Tester = 50 ชิ้น (ไม่ใช่ 1 ชิ้น)

-- อัปเดต qty_per_pack สำหรับสินค้า Tester
UPDATE master_sku
SET 
  qty_per_pack = 50,
  updated_at = CURRENT_TIMESTAMP
WHERE category = 'สินค้าทดสอบ'
OR sku_id LIKE 'TT-%';

-- แก้ไข reserved_pack_qty และ total_pack_qty ใน inventory balances
-- สำหรับ Tester SKUs ที่มีการจองอยู่
UPDATE wms_inventory_balances
SET 
  reserved_pack_qty = reserved_piece_qty / 50.0,
  total_pack_qty = total_piece_qty / 50.0,
  updated_at = CURRENT_TIMESTAMP
WHERE warehouse_id = 'WH001'
AND (
  sku_id IN (SELECT sku_id FROM master_sku WHERE category = 'สินค้าทดสอบ')
  OR sku_id LIKE 'TT-%'
);

-- แก้ไข reserved_pack_qty ใน reservations ที่มีอยู่แล้ว
-- สำหรับ bonus_face_sheet_item_reservations
UPDATE bonus_face_sheet_item_reservations
SET 
  reserved_pack_qty = reserved_piece_qty / 50.0,
  updated_at = CURRENT_TIMESTAMP
WHERE bonus_face_sheet_item_id IN (
  SELECT id FROM bonus_face_sheet_items 
  WHERE sku_id LIKE 'TT-%'
);

-- แก้ไข reserved_pack_qty ใน face_sheet_item_reservations (ถ้ามี)
UPDATE face_sheet_item_reservations
SET 
  reserved_pack_qty = reserved_piece_qty / 50.0,
  updated_at = CURRENT_TIMESTAMP
WHERE face_sheet_item_id IN (
  SELECT id FROM face_sheet_items 
  WHERE sku_id LIKE 'TT-%'
);

-- แก้ไข reserved_pack_qty ใน picklist_item_reservations (ถ้ามี)
UPDATE picklist_item_reservations
SET 
  reserved_pack_qty = reserved_piece_qty / 50.0,
  updated_at = CURRENT_TIMESTAMP
WHERE picklist_item_id IN (
  SELECT id FROM picklist_items 
  WHERE sku_id LIKE 'TT-%'
);

-- แสดงผลลัพธ์
DO $$
DECLARE
  v_sku_count INTEGER;
  v_balance_count INTEGER;
  v_reservation_count INTEGER;
BEGIN
  -- นับจำนวน SKU ที่อัปเดต
  SELECT COUNT(*) INTO v_sku_count
  FROM master_sku
  WHERE category = 'สินค้าทดสอบ' OR sku_id LIKE 'TT-%';
  
  -- นับจำนวน balance ที่อัปเดต
  SELECT COUNT(*) INTO v_balance_count
  FROM wms_inventory_balances
  WHERE warehouse_id = 'WH001'
  AND (sku_id LIKE 'TT-%' OR sku_id IN (
    SELECT sku_id FROM master_sku WHERE category = 'สินค้าทดสอบ'
  ));
  
  -- นับจำนวน reservation ที่อัปเดต
  SELECT COUNT(*) INTO v_reservation_count
  FROM bonus_face_sheet_item_reservations
  WHERE bonus_face_sheet_item_id IN (
    SELECT id FROM bonus_face_sheet_items WHERE sku_id LIKE 'TT-%'
  );
  
  RAISE NOTICE '✅ Migration 107 completed: Fixed Tester qty_per_pack';
  RAISE NOTICE '   Updated % Tester SKUs: qty_per_pack = 1 → 50', v_sku_count;
  RAISE NOTICE '   Updated % inventory balances', v_balance_count;
  RAISE NOTICE '   Updated % reservations', v_reservation_count;
  RAISE NOTICE '   Formula: reserved_pack_qty = reserved_piece_qty / 50';
  RAISE NOTICE '   Reason: 1 แพ็ค Tester = 50 ชิ้น';
END $$;

-- ตรวจสอบผลลัพธ์
SELECT 
  'Tester SKUs' as type,
  COUNT(*) as count,
  MIN(qty_per_pack) as min_qty_per_pack,
  MAX(qty_per_pack) as max_qty_per_pack
FROM master_sku
WHERE category = 'สินค้าทดสอบ' OR sku_id LIKE 'TT-%';

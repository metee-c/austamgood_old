-- Migration: แก้ไขสต็อก PK001 แบบครบถ้วน
-- Applied: 2026-01-14
-- ปัญหา: 
--   1. มี duplicate balance records จำนวนมากที่ PK001
--   2. ยอดติดลบมหาศาลจากการหยิบซ้ำซ้อน
--   3. ยอดที่นับมา (PA-20260114-00005) คือยอดก่อนจัดสินค้า FS-20260114-000
--   4. B-BEY-D|SAL|012 นับได้ 9 แต่หยิบไป 12 = ขาด 3 → หักจาก B-BEY-D|SAL|NS|012 แทน

-- ============================================================
-- STEP 1: สร้าง temp table สำหรับยอดที่นับได้ (PA-20260114-00005)
-- ============================================================
CREATE TEMP TABLE counted_stock AS
SELECT 
  sku_code as sku_id,
  SUM(quantity) as counted_qty
FROM wms_prep_area_count_items
WHERE session_id = 26
GROUP BY sku_code;

-- ============================================================
-- STEP 2: สร้าง temp table สำหรับยอดที่หยิบไปแล้ว (FS-20260114-000)
-- ============================================================
CREATE TEMP TABLE picked_stock AS
SELECT 
  fsi.sku_id,
  SUM(fsi.quantity_picked::numeric) as picked_qty
FROM face_sheet_items fsi
WHERE fsi.face_sheet_id = 82
  AND fsi.status = 'picked'
  AND fsi.sku_id IN (SELECT sku_id FROM counted_stock)
GROUP BY fsi.sku_id;

-- ============================================================
-- STEP 3: คำนวณยอดสต็อกที่ถูกต้อง
-- B-BEY-D|SAL|012 ติดลบ 3 → ตั้งเป็น 0
-- B-BEY-D|SAL|NS|012 ต้องหักเพิ่ม 3 ที่ขาดจาก B-BEY-D|SAL|012
-- ============================================================
CREATE TEMP TABLE correct_stock AS
SELECT 
  c.sku_id,
  c.counted_qty,
  COALESCE(p.picked_qty, 0) as picked_qty,
  CASE 
    WHEN c.sku_id = 'B-BEY-D|SAL|012' AND (c.counted_qty - COALESCE(p.picked_qty, 0)) < 0 THEN 0
    WHEN c.sku_id = 'B-BEY-D|SAL|NS|012' THEN c.counted_qty - COALESCE(p.picked_qty, 0) - 3
    ELSE c.counted_qty - COALESCE(p.picked_qty, 0)
  END as correct_qty
FROM counted_stock c
LEFT JOIN picked_stock p ON c.sku_id = p.sku_id;

-- ============================================================
-- STEP 4: เก็บ balance_ids ที่จะลบ
-- ============================================================
CREATE TEMP TABLE balance_ids_to_delete AS
SELECT balance_id 
FROM wms_inventory_balances 
WHERE location_id = 'PK001'
  AND sku_id IN (SELECT sku_id FROM counted_stock);

-- ============================================================
-- STEP 5: ลบ bonus_face_sheet_item_reservations
-- ============================================================
DELETE FROM bonus_face_sheet_item_reservations
WHERE balance_id IN (SELECT balance_id FROM balance_ids_to_delete);

-- ============================================================
-- STEP 6: ลบ face_sheet_item_reservations
-- ============================================================
DELETE FROM face_sheet_item_reservations
WHERE balance_id IN (SELECT balance_id FROM balance_ids_to_delete);

-- ============================================================
-- STEP 7: ลบ picklist_item_reservations
-- ============================================================
DELETE FROM picklist_item_reservations
WHERE balance_id IN (SELECT balance_id FROM balance_ids_to_delete);

-- ============================================================
-- STEP 8: ลบ balance records ทั้งหมดที่ PK001
-- ============================================================
DELETE FROM wms_inventory_balances
WHERE balance_id IN (SELECT balance_id FROM balance_ids_to_delete);

-- ============================================================
-- STEP 9: สร้าง balance records ใหม่ (เฉพาะ SKU ที่ยอด > 0)
-- ============================================================
INSERT INTO wms_inventory_balances (
  warehouse_id,
  location_id,
  sku_id,
  total_pack_qty,
  total_piece_qty,
  reserved_pack_qty,
  reserved_piece_qty,
  last_movement_at,
  created_at,
  updated_at
)
SELECT 
  'WH001',
  'PK001',
  cs.sku_id,
  cs.correct_qty / COALESCE(ms.qty_per_pack, 1),
  cs.correct_qty,
  0,
  0,
  NOW(),
  NOW(),
  NOW()
FROM correct_stock cs
JOIN master_sku ms ON cs.sku_id = ms.sku_id
WHERE cs.correct_qty > 0;

-- ============================================================
-- STEP 10: บันทึก ledger entries (เฉพาะ SKU ที่ยอด > 0)
-- ============================================================
INSERT INTO wms_inventory_ledger (
  movement_at,
  transaction_type,
  direction,
  warehouse_id,
  location_id,
  sku_id,
  piece_qty,
  pack_qty,
  reference_no,
  reference_doc_type,
  skip_balance_sync
)
SELECT 
  NOW(),
  'adjustment',
  'in',
  'WH001',
  'PK001',
  cs.sku_id,
  cs.correct_qty,
  cs.correct_qty / COALESCE(ms.qty_per_pack, 1),
  'PA-20260114-00005',
  'stock_count',
  true
FROM correct_stock cs
JOIN master_sku ms ON cs.sku_id = ms.sku_id
WHERE cs.correct_qty > 0;

-- ============================================================
-- STEP 11: อัปเดตสถานะ session
-- ============================================================
UPDATE wms_stock_count_sessions
SET 
  notes = COALESCE(notes, '') || ' | Migration 208: Fixed duplicates + FS-20260114-000 picking'
WHERE id = 26;

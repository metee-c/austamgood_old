-- Migration: แก้ไขสต็อกบ้านหยิบจากผลนับ PA-20260114-00005
-- ปัญหา: ยอดที่นับมาคือยอดก่อนจัดสินค้า FS-20260114-000 
--        แต่ระบบหยิบไปบางส่วนแล้ว ทำให้ต้องปรับสต็อกให้ถูกต้อง
-- วิธีแก้: 
--   1. ตั้งสต็อกบ้านหยิบตามยอดที่นับได้
--   2. ลดสต็อกตามยอดที่หยิบไปแล้วใน FS-20260114-000

BEGIN;

-- ============================================================
-- STEP 1: สร้าง temp table สำหรับยอดที่นับได้ (PA-20260114-00005)
-- ============================================================
CREATE TEMP TABLE counted_stock AS
SELECT 
  sku_code as sku_id,
  SUM(quantity) as counted_qty
FROM wms_prep_area_count_items
WHERE session_id = 26  -- PA-20260114-00005
GROUP BY sku_code;

-- ============================================================
-- STEP 2: สร้าง temp table สำหรับยอดที่หยิบไปแล้ว (FS-20260114-000)
-- ============================================================
CREATE TEMP TABLE picked_stock AS
SELECT 
  sku_id,
  SUM(quantity_picked::numeric) as picked_qty
FROM face_sheet_items
WHERE face_sheet_id = 82  -- FS-20260114-000
  AND status = 'picked'
GROUP BY sku_id;

-- ============================================================
-- STEP 3: คำนวณยอดสต็อกที่ถูกต้อง = ยอดนับ - ยอดหยิบ
-- ============================================================
CREATE TEMP TABLE correct_stock AS
SELECT 
  c.sku_id,
  c.counted_qty,
  COALESCE(p.picked_qty, 0) as picked_qty,
  c.counted_qty - COALESCE(p.picked_qty, 0) as correct_qty
FROM counted_stock c
LEFT JOIN picked_stock p ON c.sku_id = p.sku_id;

-- ============================================================
-- STEP 4: ดูสต็อกปัจจุบันที่บ้านหยิบ PK001
-- ============================================================
CREATE TEMP TABLE current_pk001_stock AS
SELECT 
  sku_id,
  SUM(total_piece_qty) as current_qty
FROM wms_inventory_balances
WHERE location_id = 'PK001'
GROUP BY sku_id;

-- ============================================================
-- STEP 5: คำนวณ adjustment ที่ต้องทำ
-- ============================================================
CREATE TEMP TABLE stock_adjustments AS
SELECT 
  cs.sku_id,
  cs.counted_qty,
  cs.picked_qty,
  cs.correct_qty,
  COALESCE(cur.current_qty, 0) as current_system_qty,
  cs.correct_qty - COALESCE(cur.current_qty, 0) as adjustment_qty
FROM correct_stock cs
LEFT JOIN current_pk001_stock cur ON cs.sku_id = cur.sku_id
WHERE cs.correct_qty - COALESCE(cur.current_qty, 0) != 0;

-- ============================================================
-- STEP 6: แสดงรายการที่จะปรับ (สำหรับ audit)
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  total_increase NUMERIC := 0;
  total_decrease NUMERIC := 0;
BEGIN
  RAISE NOTICE '=== รายการปรับสต็อกบ้านหยิบ PK001 ===';
  RAISE NOTICE 'SKU | นับได้ | หยิบไป | ควรเหลือ | ระบบมี | ปรับ';
  RAISE NOTICE '------------------------------------------------------------';
  
  FOR rec IN 
    SELECT * FROM stock_adjustments ORDER BY sku_id
  LOOP
    RAISE NOTICE '% | % | % | % | % | %',
      rec.sku_id,
      rec.counted_qty,
      rec.picked_qty,
      rec.correct_qty,
      rec.current_system_qty,
      rec.adjustment_qty;
    
    IF rec.adjustment_qty > 0 THEN
      total_increase := total_increase + rec.adjustment_qty;
    ELSE
      total_decrease := total_decrease + ABS(rec.adjustment_qty);
    END IF;
  END LOOP;
  
  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'รวมเพิ่ม: % ชิ้น | รวมลด: % ชิ้น', total_increase, total_decrease;
END $$;

-- ============================================================
-- STEP 7: อัปเดตสต็อกที่ PK001
-- ============================================================
-- สำหรับ SKU ที่มีอยู่แล้ว - อัปเดตยอด
UPDATE wms_inventory_balances b
SET 
  total_piece_qty = total_piece_qty + adj.adjustment_qty,
  total_pack_qty = total_pack_qty + (adj.adjustment_qty / COALESCE(ms.qty_per_pack, 1)),
  updated_at = NOW()
FROM stock_adjustments adj
JOIN master_sku ms ON adj.sku_id = ms.sku_id
WHERE b.location_id = 'PK001'
  AND b.sku_id = adj.sku_id
  AND adj.adjustment_qty != 0;

-- ============================================================
-- STEP 8: บันทึก ledger entries สำหรับการปรับสต็อก
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
  remarks,
  skip_balance_sync
)
SELECT 
  NOW(),
  'adjustment',
  CASE WHEN adj.adjustment_qty > 0 THEN 'in' ELSE 'out' END,
  'WH001',
  'PK001',
  adj.sku_id,
  ABS(adj.adjustment_qty),
  ABS(adj.adjustment_qty) / COALESCE(ms.qty_per_pack, 1),
  'PA-20260114-00005',
  'stock_count',
  'ปรับสต็อกจากผลนับบ้านหยิบ PA-20260114-00005 (คำนึงถึงการหยิบ FS-20260114-000)',
  true  -- skip trigger เพราะเราอัปเดต balance เองแล้ว
FROM stock_adjustments adj
JOIN master_sku ms ON adj.sku_id = ms.sku_id
WHERE adj.adjustment_qty != 0;

-- ============================================================
-- STEP 9: ตรวจสอบผลลัพธ์
-- ============================================================
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ตรวจสอบสต็อกหลังปรับ ===';
  RAISE NOTICE 'SKU | ควรเหลือ | ระบบมีตอนนี้ | ตรงกัน?';
  RAISE NOTICE '------------------------------------------------------------';
  
  FOR rec IN 
    SELECT 
      cs.sku_id,
      cs.correct_qty,
      COALESCE(SUM(b.total_piece_qty), 0) as system_qty,
      CASE WHEN cs.correct_qty = COALESCE(SUM(b.total_piece_qty), 0) THEN '✓' ELSE '✗' END as match
    FROM correct_stock cs
    LEFT JOIN wms_inventory_balances b ON cs.sku_id = b.sku_id AND b.location_id = 'PK001'
    GROUP BY cs.sku_id, cs.correct_qty
    ORDER BY cs.sku_id
  LOOP
    RAISE NOTICE '% | % | % | %',
      rec.sku_id,
      rec.correct_qty,
      rec.system_qty,
      rec.match;
  END LOOP;
END $$;

-- ============================================================
-- STEP 10: อัปเดตสถานะ session
-- ============================================================
UPDATE wms_stock_count_sessions
SET 
  remarks = COALESCE(remarks, '') || ' | ปรับสต็อกแล้วโดย migration 207 (คำนึงถึงการหยิบ FS-20260114-000)'
WHERE id = 26;

COMMIT;

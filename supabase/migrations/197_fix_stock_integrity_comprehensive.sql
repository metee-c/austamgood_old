-- Migration: 197_fix_stock_integrity_comprehensive.sql
-- วันที่: 11 มกราคม 2569
-- วัตถุประสงค์: แก้ไขปัญหา Stock Integrity ที่พบจาก Audit
-- 
-- ปัญหาที่แก้ไข:
-- 1. Duplicate Balance Records (83 extra records)
-- 2. Packaging Unit Mismatch (2 SKUs)
-- 3. เพิ่ม UNIQUE Constraint ป้องกัน duplicates ในอนาคต

BEGIN;

-- ============================================
-- STEP 1: ลบ Duplicate Balance Records
-- ============================================
-- เก็บไว้เฉพาะ record ที่มี balance_id ต่ำสุดในแต่ละกลุ่ม (sku_id, location_id, pallet_id)

-- 1.1 สร้าง temp table เก็บ balance_id ที่ต้องลบ
CREATE TEMP TABLE duplicate_balance_ids AS
WITH ranked AS (
  SELECT 
    balance_id,
    sku_id,
    location_id,
    pallet_id,
    ROW_NUMBER() OVER (
      PARTITION BY sku_id, location_id, COALESCE(pallet_id, '')
      ORDER BY balance_id
    ) as rn
  FROM wms_inventory_balances
)
SELECT balance_id 
FROM ranked 
WHERE rn > 1;

-- 1.2 Log จำนวน duplicates ที่จะลบ
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM duplicate_balance_ids;
  RAISE NOTICE 'จะลบ duplicate balance records จำนวน: %', dup_count;
END $$;

-- 1.3 ลบ duplicate records
DELETE FROM wms_inventory_balances
WHERE balance_id IN (SELECT balance_id FROM duplicate_balance_ids);

-- 1.4 ลบ temp table
DROP TABLE duplicate_balance_ids;

-- ============================================
-- STEP 2: แก้ไข Packaging Unit Mismatch
-- ============================================
-- SKU: 01-NET-C|FHC|010 และ OTHERS00069
-- ปัญหา: Import เข้ามาเป็น piece แต่ Transfer out เป็น pack
-- แก้ไข: ปรับ pack_qty เป็น 0 (ใช้ piece_qty แทน)

UPDATE wms_inventory_balances b
SET 
  total_pack_qty = 0,
  updated_at = NOW()
FROM master_location l
WHERE b.location_id = l.location_id
  AND l.location_code = 'Packaging'
  AND b.sku_id IN ('01-NET-C|FHC|010', 'OTHERS00069')
  AND b.total_pack_qty < 0;

-- ============================================
-- STEP 3: เพิ่ม UNIQUE Constraint
-- ============================================
-- ป้องกันการสร้าง duplicate balance records ในอนาคต

-- 3.1 ตรวจสอบว่ามี constraint อยู่แล้วหรือไม่
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_balance_sku_location_pallet'
  ) THEN
    -- สร้าง unique index แทน constraint เพื่อรองรับ NULL values
    CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_sku_location_pallet 
    ON wms_inventory_balances (sku_id, location_id, COALESCE(pallet_id, ''));
    
    RAISE NOTICE 'สร้าง unique index สำเร็จ';
  ELSE
    RAISE NOTICE 'Constraint มีอยู่แล้ว';
  END IF;
END $$;

-- ============================================
-- STEP 4: บันทึก Ledger entries สำหรับการปรับ
-- ============================================
-- บันทึกการปรับ Packaging เป็น ledger entry

INSERT INTO wms_inventory_ledger (
  movement_at,
  transaction_type,
  direction,
  warehouse_id,
  location_id,
  sku_id,
  pallet_id,
  pack_qty,
  piece_qty,
  reference_no,
  remarks,
  created_at,
  updated_at
)
SELECT 
  NOW(),
  'adjustment',
  'in',
  b.warehouse_id,
  b.location_id,
  b.sku_id,
  b.pallet_id,
  ABS(b.total_pack_qty), -- ปรับเข้าเท่ากับจำนวนที่ติดลบ
  0,
  'FIX-197-PACKAGING',
  'แก้ไข Unit Mismatch - ปรับ pack_qty เป็น 0 (migration 197)',
  NOW(),
  NOW()
FROM wms_inventory_balances b
JOIN master_location l ON l.location_id = b.location_id
WHERE l.location_code = 'Packaging'
  AND b.sku_id IN ('01-NET-C|FHC|010', 'OTHERS00069')
  AND b.total_pack_qty < 0;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (ไม่ได้รันอัตโนมัติ)
-- ============================================
/*
-- ตรวจสอบว่าไม่มี duplicates แล้ว
SELECT sku_id, location_id, COUNT(*) as count
FROM wms_inventory_balances
GROUP BY sku_id, location_id
HAVING COUNT(*) > 1;

-- ตรวจสอบ Packaging
SELECT b.sku_id, l.location_code, b.total_pack_qty, b.total_piece_qty
FROM wms_inventory_balances b
JOIN master_location l ON l.location_id = b.location_id
WHERE l.location_code = 'Packaging';

-- ตรวจสอบ Negative Balances ที่เหลือ
SELECT COUNT(*) FROM wms_inventory_balances
WHERE total_pack_qty < 0 OR total_piece_qty < 0;
*/

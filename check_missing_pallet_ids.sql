-- ============================================================================
-- SQL Script: ตรวจสอบสินค้าพรีเมี่ยมที่ไม่มีพาเลทไอดี
-- ============================================================================

-- 1. ตรวจสอบสินค้าพรีเมี่ยมที่ไม่มี pallet_id ในระบบปัจจุบัน
SELECT 
  b.balance_id,
  s.sku_code,
  s.sku_name,
  l.location_code,
  l.location_name,
  b.pallet_id,
  b.lot_no,
  b.total_piece_qty,
  b.production_date,
  b.expiry_date,
  b.created_at,
  b.last_movement_at,
  b.updated_at
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
JOIN master_location l ON b.location_id = l.location_id
WHERE b.pallet_id IS NULL
  AND b.total_piece_qty > 0
  AND s.sku_name LIKE '%พรีเมี่ยม%'
ORDER BY b.created_at DESC;

-- 2. ตรวจสอบประวัติการเคลื่อนไหวของสินค้าพรีเมี่ยมที่ไม่มี pallet_id
SELECT 
  il.ledger_id,
  il.transaction_type,
  il.pallet_id,
  s.sku_code,
  s.sku_name,
  l.location_code,
  il.piece_qty,
  il.movement_at,
  il.created_at,
  il.reference_type,
  il.reference_id
FROM wms_inventory_ledger il
JOIN master_sku s ON il.sku_id = s.sku_id
LEFT JOIN master_location l ON il.location_id = l.location_id
WHERE s.sku_name LIKE '%พรีเมี่ยม%'
  AND il.pallet_id IS NULL
ORDER BY il.created_at DESC
LIMIT 50;

-- 3. ตรวจสอบข้อมูลการนำเข้าสต็อก (Stock Import) ของสินค้าพรีเมี่ยม
SELECT 
  sis.staging_id,
  sis.batch_id,
  sis.sku_id,
  s.sku_name,
  sis.pallet_id_external,
  sis.pallet_id_check,
  sis.piece_qty,
  sis.location_code,
  sis.validation_status,
  sis.created_at
FROM stock_import_staging sis
LEFT JOIN master_sku s ON sis.sku_id = s.sku_id
WHERE s.sku_name LIKE '%พรีเมี่ยม%'
ORDER BY sis.created_at DESC
LIMIT 50;

-- 4. เปรียบเทียบข้อมูล: สินค้าที่นำเข้ามีพาเลทไอดี แต่ในระบบไม่มี
SELECT 
  sis.staging_id,
  s.sku_name,
  sis.pallet_id_external AS 'pallet_id_in_import',
  b.pallet_id AS 'pallet_id_in_system',
  sis.location_code,
  sis.piece_qty AS 'import_qty',
  b.total_piece_qty AS 'system_qty',
  sis.created_at AS 'import_date',
  b.created_at AS 'balance_created_date'
FROM stock_import_staging sis
LEFT JOIN master_sku s ON sis.sku_id = s.sku_id
LEFT JOIN wms_inventory_balances b ON (
  b.sku_id = sis.sku_id 
  AND b.location_id = sis.location_code
  AND (b.pallet_id = sis.pallet_id_external OR (b.pallet_id IS NULL AND sis.pallet_id_external IS NULL))
)
WHERE s.sku_name LIKE '%พรีเมี่ยม%'
  AND sis.pallet_id_external IS NOT NULL
  AND sis.validation_status = 'valid'
ORDER BY sis.created_at DESC
LIMIT 50;

-- 5. หาสินค้าที่มีการย้ายหลังจากนำเข้า (อาจทำให้พาเลทไอดีหาย)
SELECT 
  il.ledger_id,
  il.transaction_type,
  s.sku_name,
  il.pallet_id AS 'pallet_id_in_ledger',
  b.pallet_id AS 'pallet_id_in_balance',
  il.from_location_id,
  il.location_id AS 'to_location_id',
  il.piece_qty,
  il.movement_at,
  il.created_at
FROM wms_inventory_ledger il
JOIN master_sku s ON il.sku_id = s.sku_id
LEFT JOIN wms_inventory_balances b ON (
  b.sku_id = il.sku_id 
  AND b.location_id = il.location_id
)
WHERE s.sku_name LIKE '%พรีเมี่ยม%'
  AND il.transaction_type IN ('move', 'transfer')
  AND il.pallet_id IS NOT NULL
  AND b.pallet_id IS NULL
ORDER BY il.created_at DESC
LIMIT 50;

-- 6. สรุปจำนวนสินค้าพรีเมี่ยมที่มีและไม่มีพาเลทไอดี
SELECT 
  CASE 
    WHEN b.pallet_id IS NULL THEN 'ไม่มี Pallet ID'
    ELSE 'มี Pallet ID'
  END AS status,
  COUNT(*) AS count,
  SUM(b.total_piece_qty) AS total_pieces
FROM wms_inventory_balances b
JOIN master_sku s ON b.sku_id = s.sku_id
WHERE s.sku_name LIKE '%พรีเมี่ยม%'
  AND b.total_piece_qty > 0
GROUP BY CASE WHEN b.pallet_id IS NULL THEN 'ไม่มี Pallet ID' ELSE 'มี Pallet ID' END;

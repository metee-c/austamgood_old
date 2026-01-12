
Query 1: ตรวจสอบ Ledger มี Duplicate หรือไม่
sql-- ตรวจสอบว่า ledger entries มีซ้ำหรือไม่
SELECT 
  product_id,
  from_location_id,
  to_location_id,
  transaction_type,
  quantity,
  COUNT(*) as count
FROM wms_inventory_ledger
WHERE reference_type = 'face_sheet'
  AND reference_id = 78
GROUP BY product_id, from_location_id, to_location_id, transaction_type, quantity
HAVING COUNT(*) > 1;

Query 2: เปรียบเทียบ Items vs Ledger
sql-- เปรียบเทียบจำนวน items ที่ควรย้าย vs ledger ที่บันทึก
WITH items_summary AS (
  SELECT 
    fsi.sku_id,
    SUM(fsi.quantity) as total_item_qty,
    COUNT(*) as item_count
  FROM face_sheet_items fsi
  WHERE fsi.face_sheet_id = 78
    AND fsi.status = 'picked'
  GROUP BY fsi.sku_id
),
ledger_summary AS (
  SELECT 
    p.product_code as sku_id,
    SUM(CASE WHEN il.transaction_type = 'pick' THEN ABS(il.piece_qty) ELSE 0 END) as ledger_out_qty,
    COUNT(*) as ledger_count
  FROM wms_inventory_ledger il
  JOIN master_products p ON p.product_id = il.product_id
  WHERE il.reference_type = 'face_sheet'
    AND il.reference_id = 78
  GROUP BY p.product_code
)
SELECT 
  COALESCE(i.sku_id, l.sku_id) as sku_id,
  i.total_item_qty as items_qty,
  i.item_count,
  l.ledger_out_qty,
  l.ledger_count,
  CASE 
    WHEN i.total_item_qty = l.ledger_out_qty THEN '✅ ตรง'
    WHEN i.total_item_qty > l.ledger_out_qty THEN '⚠️ Items มากกว่า Ledger'
    WHEN i.total_item_qty < l.ledger_out_qty THEN '❌ Ledger มากกว่า Items'
    ELSE '❓ ไม่มีข้อมูล'
  END as status
FROM items_summary i
FULL OUTER JOIN ledger_summary l ON i.sku_id = l.sku_id
ORDER BY i.sku_id;

Query 3: ตรวจสอบ Unique Items vs Ledger
sql-- นับเฉพาะ unique order_item_id (ไม่นับซ้ำ)
WITH unique_items AS (
  SELECT DISTINCT ON (order_item_id)
    order_item_id,
    sku_id,
    quantity
  FROM face_sheet_items
  WHERE face_sheet_id = 78
    AND status = 'picked'
),
items_summary AS (
  SELECT 
    sku_id,
    SUM(quantity) as unique_item_qty,
    COUNT(*) as unique_count
  FROM unique_items
  GROUP BY sku_id
),
ledger_summary AS (
  SELECT 
    p.product_code as sku_id,
    SUM(ABS(il.piece_qty)) as ledger_qty,
    COUNT(*) as ledger_count
  FROM wms_inventory_ledger il
  JOIN master_products p ON p.product_id = il.product_id
  WHERE il.reference_type = 'face_sheet'
    AND il.reference_id = 78
    AND il.transaction_type = 'pick'
  GROUP BY p.product_code
)
SELECT 
  COALESCE(i.sku_id, l.sku_id) as sku_id,
  i.unique_item_qty,
  i.unique_count as unique_items,
  l.ledger_qty,
  l.ledger_count as ledger_entries,
  CASE 
    WHEN i.unique_item_qty = l.ledger_qty THEN '✅ สต็อกถูกต้อง'
    WHEN i.unique_item_qty > l.ledger_qty THEN '⚠️ ย้ายน้อยกว่าที่ควร'
    WHEN i.unique_item_qty < l.ledger_qty THEN '❌ ย้ายมากกว่าที่ควร'
    ELSE '❓'
  END as stock_status
FROM items_summary i
FULL OUTER JOIN ledger_summary l ON i.sku_id = l.sku_id
ORDER BY i.sku_id;

Query 4: สรุปภาพรวม
sql-- สรุปตัวเลขรวม
SELECT 
  'Face Sheet Items (All)' as category,
  COUNT(*) as count,
  SUM(quantity) as total_qty
FROM face_sheet_items
WHERE face_sheet_id = 78

UNION ALL

SELECT 
  'Face Sheet Items (Unique order_item_id)' as category,
  COUNT(DISTINCT order_item_id) as count,
  NULL as total_qty
FROM face_sheet_items
WHERE face_sheet_id = 78

UNION ALL

SELECT 
  'Ledger Entries (OUT/pick)' as category,
  COUNT(*) as count,
  SUM(ABS(piece_qty)) as total_qty
FROM wms_inventory_ledger
WHERE reference_type = 'face_sheet'
  AND reference_id = 78
  AND transaction_type = 'pick'

UNION ALL

SELECT 
  'Ledger Entries (IN/transfer)' as category,
  COUNT(*) as count,
  SUM(ABS(piece_qty)) as total_qty
FROM wms_inventory_ledger
WHERE reference_type = 'face_sheet'
  AND reference_id = 78
  AND transaction_type != 'pick';

📋 คำตอบที่คาดหวัง
สถานการณ์สต็อกผิดไหม?ต้องแก้ไหม?Ledger ไม่มี duplicate + ตรงกับ unique items✅ ไม่ผิด❌ ไม่ต้องLedger มี duplicate (ย้ายซ้ำ)❌ ผิด✅ ต้องแก้Ledger น้อยกว่า unique items⚠️ ย้ายไม่ครบ✅ ต้องย้ายเพิ่มLedger มากกว่า unique items❌ ย้ายเกิน✅ ต้อง reverse
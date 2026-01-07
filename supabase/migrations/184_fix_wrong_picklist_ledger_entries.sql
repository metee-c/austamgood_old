-- Migration 184: Fix wrong picklist ledger entries
-- ปัญหา: Ledger entries ถูกสร้างด้วย reference_no (picklist_code) ที่ไม่ตรงกับ order_item_id
-- สาเหตุ: หน้า mobile pick ส่ง request ด้วย item_id ที่ไม่ตรงกับ picklist_id
-- แก้ไข: ลบ ledger entries ที่ผิด

-- Step 1: Log wrong entries before deletion
INSERT INTO stock_correction_log (correction_type, notes, correction_date)
SELECT 
  'wrong_picklist_ledger_entries',
  'Ledger entries with order_item_id not matching picklist_items for picklist: ' || reference_no || ' - Count: ' || COUNT(*),
  NOW()
FROM wms_inventory_ledger l
WHERE l.reference_doc_type = 'picklist'
  AND l.reference_no IN ('PL-20260106-008', 'PL-20260106-009', 'PL-20260106-010')
  AND NOT EXISTS (
    SELECT 1 FROM picklist_items pi
    WHERE pi.picklist_id = l.reference_doc_id
      AND pi.order_item_id = l.order_item_id
  )
GROUP BY reference_no;

-- Step 2: Delete wrong ledger entries (both OUT and IN)
DELETE FROM wms_inventory_ledger
WHERE ledger_id IN (
  SELECT l.ledger_id
  FROM wms_inventory_ledger l
  WHERE l.reference_doc_type = 'picklist'
    AND l.reference_no IN ('PL-20260106-008', 'PL-20260106-009', 'PL-20260106-010')
    AND NOT EXISTS (
      SELECT 1 FROM picklist_items pi
      WHERE pi.picklist_id = l.reference_doc_id
        AND pi.order_item_id = l.order_item_id
    )
);

-- Step 3: Fix TUN|070 IN entry for PL-20260106-009 (OUT=34, IN=50 -> IN=34)
UPDATE wms_inventory_ledger
SET piece_qty = 34, pack_qty = 34
WHERE reference_no = 'PL-20260106-009'
  AND sku_id = 'B-BEY-C|TUN|070'
  AND direction = 'in';

-- Log completion
INSERT INTO stock_correction_log (correction_type, notes, correction_date)
VALUES ('wrong_picklist_ledger_entries_deleted', 'Deleted wrong ledger entries for PL-20260106-008/009/010 and fixed TUN|070 mismatch', NOW());

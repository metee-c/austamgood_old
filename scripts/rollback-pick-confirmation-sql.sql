-- Rollback การยืนยันหยิบ 3 ใบ (PL-312, PL-313, PL-314)
-- Run this with: psql -h <host> -U postgres -d postgres -f scripts/rollback-pick-confirmation-sql.sql

BEGIN;

-- 1. Disable trigger ชั่วคราว
ALTER TABLE picklists DISABLE TRIGGER trigger_validate_picklist_status;

-- 2. ลบ ledger entries
DELETE FROM wms_inventory_ledger
WHERE reference_doc_type = 'picklist'
  AND reference_doc_id IN (312, 313, 314)
  AND transaction_type = 'pick';

-- 3. Update reservations: picked → reserved
UPDATE picklist_item_reservations
SET status = 'reserved',
    picked_at = NULL
WHERE picklist_item_id IN (
  SELECT id FROM picklist_items WHERE picklist_id IN (312, 313, 314)
)
AND status = 'picked';

-- 4. คืนยอดจองใน wms_inventory_balances
-- ต้องทำทีละ balance เพราะต้องคำนวณจาก reservation
WITH reservation_totals AS (
  SELECT 
    pir.balance_id,
    SUM(pir.reserved_piece_qty) as total_reserved_pieces,
    SUM(pir.reserved_pack_qty) as total_reserved_packs
  FROM picklist_item_reservations pir
  JOIN picklist_items pi ON pir.picklist_item_id = pi.id
  WHERE pi.picklist_id IN (312, 313, 314)
  GROUP BY pir.balance_id
)
UPDATE wms_inventory_balances wb
SET 
  reserved_piece_qty = wb.reserved_piece_qty + rt.total_reserved_pieces,
  reserved_pack_qty = wb.reserved_pack_qty + rt.total_reserved_packs,
  total_piece_qty = GREATEST(wb.total_piece_qty, wb.reserved_piece_qty + rt.total_reserved_pieces),
  total_pack_qty = GREATEST(wb.total_pack_qty, wb.reserved_pack_qty + rt.total_reserved_packs)
FROM reservation_totals rt
WHERE wb.balance_id = rt.balance_id;

-- 5. Update picklist_items: picked → pending
UPDATE picklist_items
SET status = 'pending',
    quantity_picked = NULL,
    picked_at = NULL,
    picked_by_employee_id = NULL
WHERE picklist_id IN (312, 313, 314);

-- 6. Update picklists: completed → pending
UPDATE picklists
SET status = 'pending',
    picking_completed_at = NULL,
    picking_started_at = NULL
WHERE id IN (312, 313, 314);

-- 7. Re-enable trigger
ALTER TABLE picklists ENABLE TRIGGER trigger_validate_picklist_status;

-- 8. Verify
SELECT 
  id,
  picklist_code,
  status,
  picking_completed_at
FROM picklists
WHERE id IN (312, 313, 314)
ORDER BY id;

SELECT 
  COUNT(*) as total_reservations,
  SUM(reserved_piece_qty) as total_reserved_pieces
FROM wms_inventory_balances
WHERE reserved_piece_qty > 0;

COMMIT;

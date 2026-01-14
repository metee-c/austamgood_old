-- Migration: Cleanup orphan reservations at PK001
-- Date: 2026-01-14
-- Issue: ยอดจองค้างที่ PK001 ไม่มีเอกสารอ้างอิง (face_sheet, bonus_face_sheet, picklist reservations ที่ยังเป็น 'reserved' = 0)
-- Root cause: picklist_item_reservations ถูกเปลี่ยนเป็น 'picked' แต่ไม่ได้ลดยอดจองใน balance

-- ตรวจสอบก่อน cleanup
DO $$
DECLARE
  orphan_count INT;
BEGIN
  -- นับจำนวน orphan reservations
  SELECT COUNT(*) INTO orphan_count
  FROM wms_inventory_balances b
  WHERE b.reserved_piece_qty > 0
    AND b.balance_id IN (29318, 29320, 29334, 29319, 29099, 29377)
    AND NOT EXISTS (
      SELECT 1 FROM face_sheet_item_reservations r 
      WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM bonus_face_sheet_item_reservations r 
      WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM picklist_item_reservations r 
      WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
    );
  
  RAISE NOTICE 'Found % orphan reservation balances to cleanup', orphan_count;
END $$;

-- Cleanup: ลดยอดจองค้างที่ไม่มีเอกสารอ้างอิง
UPDATE wms_inventory_balances b
SET 
  reserved_piece_qty = 0,
  reserved_pack_qty = 0,
  updated_at = NOW()
WHERE b.balance_id IN (29318, 29320, 29334, 29319, 29099, 29377)
  AND b.reserved_piece_qty > 0
  AND NOT EXISTS (
    SELECT 1 FROM face_sheet_item_reservations r 
    WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
  )
  AND NOT EXISTS (
    SELECT 1 FROM bonus_face_sheet_item_reservations r 
    WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
  )
  AND NOT EXISTS (
    SELECT 1 FROM picklist_item_reservations r 
    WHERE r.balance_id = b.balance_id AND r.status = 'reserved'
  );

-- Log cleanup result
DO $$
DECLARE
  affected_rows INT;
BEGIN
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphan reservation balances', affected_rows;
END $$;

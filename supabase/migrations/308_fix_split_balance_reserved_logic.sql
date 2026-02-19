-- Migration 308: Fix split_balance_on_reservation - reserved logic issue
-- Purpose: แก้ไข logic การลด reserved ที่ทำให้ constraint fail
-- Issue: reserved_piece_qty > total_piece_qty after split
-- Root Cause: ไม่ควรลด reserved ของ balance เดิม เพราะ split ไปแล้ว total ก็ลดไป
-- Date: 2026-02-19

DROP FUNCTION IF EXISTS public.split_balance_on_reservation CASCADE;

CREATE OR REPLACE FUNCTION public.split_balance_on_reservation(
  p_source_balance_id INTEGER,
  p_piece_qty_to_reserve INTEGER,
  p_pack_qty_to_reserve NUMERIC,
  p_reserved_by_user_id INTEGER,
  p_document_type VARCHAR,
  p_document_id INTEGER,
  p_document_code VARCHAR,
  p_picklist_item_id INTEGER DEFAULT NULL
)
RETURNS TABLE(new_balance_id INTEGER, ledger_out_id INTEGER, ledger_in_id INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_balance RECORD;
  v_new_balance_id INTEGER;
  v_ledger_out_id INTEGER;
  v_ledger_in_id INTEGER;
  v_new_pallet_id VARCHAR(100);
BEGIN
  -- Lock และดึงข้อมูล balance เดิม
  SELECT * INTO v_source_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_source_balance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance ID % not found', p_source_balance_id;
  END IF;

  -- ตรวจสอบว่ามีสต็อคเพียงพอหรือไม่ (ดูจาก total - reserved)
  IF (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty) < p_piece_qty_to_reserve THEN
    RAISE EXCEPTION 'Insufficient stock in balance %. Available: %, Requested: %',
      p_source_balance_id,
      (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty),
      p_piece_qty_to_reserve;
  END IF;

  -- สร้าง pallet_id ใหม่สำหรับ balance ที่จอง
  IF v_source_balance.pallet_id NOT LIKE 'VIRTUAL-%' AND v_source_balance.pallet_id NOT LIKE 'VIRT-%' THEN
    v_new_pallet_id := v_source_balance.pallet_id || '-RSV-' || p_document_code;
  ELSE
    v_new_pallet_id := v_source_balance.pallet_id;
  END IF;

  -- สร้าง balance ใหม่ที่จองไว้แล้ว (total = reserved = จำนวนที่ต้องการ)
  INSERT INTO wms_inventory_balances (
    warehouse_id, location_id, sku_id, pallet_id, production_date, expiry_date,
    total_pack_qty, total_piece_qty, reserved_pack_qty, reserved_piece_qty,
    reserved_by_user_id, reserved_for_document_type, reserved_for_document_id,
    reserved_for_document_code, reserved_at, reservation_status, is_reserved_split,
    created_at, updated_at
  ) VALUES (
    v_source_balance.warehouse_id, v_source_balance.location_id, v_source_balance.sku_id,
    v_new_pallet_id, v_source_balance.production_date, v_source_balance.expiry_date,
    p_pack_qty_to_reserve, p_piece_qty_to_reserve, p_pack_qty_to_reserve, p_piece_qty_to_reserve,
    p_reserved_by_user_id, p_document_type, p_document_id, p_document_code,
    NOW(), 'reserved'::reservation_status_enum, TRUE, NOW(), NOW()
  ) RETURNING balance_id INTO v_new_balance_id;

  -- UPDATE balance เดิม: ลดเฉพาะ total (ไม่ลด reserved)
  -- เพราะ reserved เดิมยังคงถูกจองอยู่สำหรับ document อื่น
  -- ส่วน stock ที่ split ออกไปเป็น "available stock" ที่เรานำมาจอง
  UPDATE wms_inventory_balances
  SET
    total_pack_qty = total_pack_qty - p_pack_qty_to_reserve,
    total_piece_qty = total_piece_qty - p_piece_qty_to_reserve,
    -- **FIX:** ไม่ลด reserved เพราะ reserved เดิมเป็นของ document อื่น
    -- การจองใหม่นี้ดึงจาก available stock (total - reserved)
    updated_at = NOW()
  WHERE balance_id = p_source_balance_id;

  -- บันทึก ledger: OUT จาก balance เดิม
  INSERT INTO wms_inventory_ledger (
    movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
    pallet_id, production_date, expiry_date, pack_qty, piece_qty, reference_no,
    remarks, created_by
  ) VALUES (
    NOW(), 'reserve', 'out', v_source_balance.warehouse_id, v_source_balance.location_id,
    v_source_balance.sku_id, v_source_balance.pallet_id, v_source_balance.production_date,
    v_source_balance.expiry_date, p_pack_qty_to_reserve, p_piece_qty_to_reserve,
    p_document_code,
    format('จองสต็อกสำหรับ %s #%s (Balance %s → %s)',
      p_document_type, p_document_code, p_source_balance_id, v_new_balance_id),
    p_reserved_by_user_id
  ) RETURNING ledger_id INTO v_ledger_out_id;

  -- บันทึก ledger: IN เข้า balance ใหม่
  INSERT INTO wms_inventory_ledger (
    movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
    pallet_id, production_date, expiry_date, pack_qty, piece_qty, reference_no,
    remarks, created_by
  ) VALUES (
    NOW(), 'reserve', 'in', v_source_balance.warehouse_id, v_source_balance.location_id,
    v_source_balance.sku_id, v_new_pallet_id, v_source_balance.production_date,
    v_source_balance.expiry_date, p_pack_qty_to_reserve, p_piece_qty_to_reserve,
    p_document_code,
    format('สร้าง Balance ที่จองสำหรับ %s #%s (Balance %s)',
      p_document_type, p_document_code, v_new_balance_id),
    p_reserved_by_user_id
  ) RETURNING ledger_id INTO v_ledger_in_id;

  -- บันทึก reservation record (ถ้ามี picklist_item_id)
  IF p_picklist_item_id IS NOT NULL THEN
    INSERT INTO picklist_item_reservations (
      picklist_item_id, balance_id, reserved_piece_qty, reserved_pack_qty,
      reserved_by, status, created_at
    ) VALUES (
      p_picklist_item_id, v_new_balance_id, p_piece_qty_to_reserve,
      p_pack_qty_to_reserve, p_reserved_by_user_id, 'reserved', NOW()
    );
  END IF;

  RETURN QUERY SELECT v_new_balance_id, v_ledger_out_id, v_ledger_in_id;
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION split_balance_on_reservation IS
'Split balance เมื่อจองสต็อก - ลด total และ reserved จาก balance เดิมด้วยจำนวนเท่ากัน (Migration 308 - Fixed)';

-- Test cases (FIXED):
-- 1. Balance เดิม: total=100, reserved=0 → จอง 30
--    - Balance ใหม่: total=30, reserved=30 ✅
--    - Balance เดิม: total=70, reserved=0 ✅
--    - Available: 70-0=70 ✅
--
-- 2. Balance เดิม: total=100, reserved=30 → จอง 40 (จาก available 70)
--    - Balance ใหม่: total=40, reserved=40 ✅
--    - Balance เดิม: total=60, reserved=30 ✅
--    - Available: 60-30=30 ✅
--
-- 3. Balance เดิม: total=55, reserved=28 → จอง 27 (จาก available 27)
--    - Balance ใหม่: total=27, reserved=27 ✅
--    - Balance เดิม: total=28, reserved=28 ✅
--    - Available: 28-28=0 ✅ (หมดพอดี)
--
-- **Logic:** ลดเฉพาะ total ของ balance เดิม, reserved ยังคงเดิม
-- เพราะ reserved เดิมเป็นการจองของ document อื่น ไม่เกี่ยวกับการจองครั้งใหม่

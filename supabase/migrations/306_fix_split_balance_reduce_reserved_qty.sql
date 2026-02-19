-- Migration 306: Fix split_balance_on_reservation to reduce reserved_piece_qty from source balance
-- Purpose: แก้ไขปัญหา constraint violation เมื่อ split balance หลายครั้ง
-- Issue: Function ลดเฉพาะ total_piece_qty แต่ไม่ลด reserved_piece_qty ทำให้ reserved > total
-- Solution: ลดทั้ง total_piece_qty และ reserved_piece_qty จาก balance เดิม
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
  SELECT * INTO v_source_balance
  FROM wms_inventory_balances
  WHERE balance_id = p_source_balance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Balance ID % not found', p_source_balance_id;
  END IF;

  IF (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty) < p_piece_qty_to_reserve THEN
    RAISE EXCEPTION 'Insufficient stock in balance %. Available: %, Requested: %', 
      p_source_balance_id,
      (v_source_balance.total_piece_qty - v_source_balance.reserved_piece_qty),
      p_piece_qty_to_reserve;
  END IF;

  IF v_source_balance.pallet_id NOT LIKE 'VIRTUAL-%' THEN
    v_new_pallet_id := v_source_balance.pallet_id || '-RSV-' || p_document_code;
  ELSE
    v_new_pallet_id := v_source_balance.pallet_id;
  END IF;

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

  UPDATE wms_inventory_balances
  SET 
    total_pack_qty = total_pack_qty - p_pack_qty_to_reserve,
    total_piece_qty = total_piece_qty - p_piece_qty_to_reserve,
    reserved_pack_qty = GREATEST(0, reserved_pack_qty - p_pack_qty_to_reserve),
    reserved_piece_qty = GREATEST(0, reserved_piece_qty - p_piece_qty_to_reserve),
    updated_at = NOW()
  WHERE balance_id = p_source_balance_id;

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

COMMENT ON FUNCTION split_balance_on_reservation IS 
'Split balance เมื่อจองสต็อก - ลดทั้ง total และ reserved จาก balance เดิม (Migration 306)';

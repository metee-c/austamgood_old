-- Migration: 106_fix_bonus_fs_reservation_null_location.sql
-- Description: แก้ไข function จองสต็อคให้รองรับกรณี source_location_id เป็น NULL
-- Date: 2025-12-02
-- Issue: Function ข้ามรายการที่ source_location_id IS NULL ทำให้ไม่จองสต็อค
-- Fix: ถ้า source_location_id IS NULL ให้ใช้ทุก location ใน warehouse

DROP FUNCTION IF EXISTS reserve_stock_for_bonus_face_sheet_items(BIGINT, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
  success BOOLEAN,
  items_reserved INTEGER,
  items_total INTEGER,
  message TEXT
) LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_balance RECORD;
  v_items_count INTEGER := 0;
  v_items_reserved INTEGER := 0;
  v_remaining_qty NUMERIC;
  v_qty_to_reserve NUMERIC;
  v_pack_to_reserve NUMERIC;
  v_qty_per_pack NUMERIC;
  v_available_qty NUMERIC;
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

  -- ดึงรายการสินค้าทั้งหมดที่ต้องจอง
  -- ✅ FIX: ไม่เช็ค source_location_id IS NOT NULL อีกต่อไป
  FOR v_item IN
    SELECT
      bfsi.id,
      bfsi.sku_id,
      bfsi.source_location_id,
      bfsi.quantity_to_pick,
      COALESCE(ms.qty_per_pack, 1) as qty_per_pack
    FROM bonus_face_sheet_items bfsi
    LEFT JOIN master_sku ms ON bfsi.sku_id = ms.sku_id
    WHERE bfsi.face_sheet_id = p_bonus_face_sheet_id
      AND bfsi.quantity_to_pick > 0
      AND bfsi.sku_id IS NOT NULL
    ORDER BY bfsi.id
  LOOP
    v_items_count := v_items_count + 1;
    v_remaining_qty := v_item.quantity_to_pick;
    v_qty_per_pack := v_item.qty_per_pack;

    RAISE NOTICE '  📋 Item %: SKU=%, qty=%, location=%', v_item.id, v_item.sku_id, v_remaining_qty, v_item.source_location_id;

    -- Query balances with FEFO + FIFO
    -- ✅ FIX: ถ้า source_location_id IS NULL ให้ใช้ทุก location ใน warehouse
    FOR v_balance IN
      SELECT
        balance_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty,
        total_pack_qty,
        reserved_pack_qty,
        production_date,
        expiry_date,
        lot_no,
        (total_piece_qty - COALESCE(reserved_piece_qty, 0)) as available_piece_qty
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND sku_id = v_item.sku_id
        AND (total_piece_qty - COALESCE(reserved_piece_qty, 0)) > 0
        -- ✅ FIX: ถ้ามี source_location_id ให้ใช้ ถ้าไม่มีให้ query ทุก location
        AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,  -- Non-expiring last
        expiry_date ASC NULLS LAST,                       -- FEFO
        production_date ASC NULLS LAST,                   -- FIFO
        lot_no ASC NULLS LAST,
        balance_id ASC
    LOOP
      v_available_qty := v_balance.available_piece_qty;

      -- คำนวณจำนวนที่จะจอง
      IF v_remaining_qty <= v_available_qty THEN
        v_qty_to_reserve := v_remaining_qty;
      ELSE
        v_qty_to_reserve := v_available_qty;
      END IF;

      v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

      RAISE NOTICE '    ✅ Reserve from balance %: %.3f pieces (%.3f packs)',
        v_balance.balance_id, v_qty_to_reserve, v_pack_to_reserve;

      -- Update balance: เพิ่ม reserved_piece_qty
      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + v_qty_to_reserve,
        reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + v_pack_to_reserve,
        updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

      -- Insert reservation record
      INSERT INTO bonus_face_sheet_item_reservations (
        bonus_face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        reserved_by,
        status
      ) VALUES (
        v_item.id,
        v_balance.balance_id,
        v_qty_to_reserve,
        v_pack_to_reserve,
        p_reserved_by,
        'reserved'
      );

      v_remaining_qty := v_remaining_qty - v_qty_to_reserve;

      -- ถ้าจองครบแล้วให้หยุด
      IF v_remaining_qty <= 0 THEN
        v_items_reserved := v_items_reserved + 1;
        EXIT;
      END IF;
    END LOOP;

    -- ถ้าจองไม่ครบ
    IF v_remaining_qty > 0 THEN
      RAISE WARNING '⚠️  Item % (SKU %): Reserved only %.3f/%.3f pieces (shortage: %.3f)',
        v_item.id, v_item.sku_id, (v_item.quantity_to_pick - v_remaining_qty),
        v_item.quantity_to_pick, v_remaining_qty;
    END IF;
  END LOOP;

  -- สรุปผล
  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve (check sku_id and quantity_to_pick)';
  ELSIF v_items_reserved = v_items_count THEN
    RETURN QUERY SELECT true, v_items_reserved, v_items_count,
      format('Reserved %s/%s items successfully', v_items_reserved, v_items_count);
  ELSE
    RETURN QUERY SELECT false, v_items_reserved, v_items_count,
      format('Partial reservation: %s/%s items (check stock availability)', v_items_reserved, v_items_count);
  END IF;

  RAISE NOTICE '✅ Reservation complete: %/%', v_items_reserved, v_items_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
  'จองสต็อคสำหรับ Bonus Face Sheet Items (FEFO+FIFO) - รองรับ source_location_id = NULL';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 106 completed: Fixed reservation function to handle NULL source_location_id';
  RAISE NOTICE '   Function: reserve_stock_for_bonus_face_sheet_items()';
  RAISE NOTICE '   Fix: Allow NULL source_location_id (use all warehouse locations)';
END $$;

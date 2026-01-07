-- Migration: 188_fix_bonus_fs_reservation_prep_areas_only.sql
-- Description: แก้ไข function จองสต็อคให้จองจาก preparation areas เท่านั้น
-- Date: 2026-01-07
-- Issue: Function จองสต็อคจากทุก location รวมถึง Delivery-In-Progress, Expired, Dispatch
-- Fix: จำกัดให้จองจาก locations ที่อยู่ใน preparation_area zones เท่านั้น

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
) LANGUAGE plpgsql AS $func$
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
  v_prep_area_zones TEXT[];
  v_prep_area_location_ids TEXT[];
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

  -- ✅ FIX: ดึง zones ทั้งหมดจาก preparation_area table
  SELECT ARRAY_AGG(DISTINCT zone) INTO v_prep_area_zones
  FROM preparation_area
  WHERE zone IS NOT NULL;

  RAISE NOTICE '📍 Preparation area zones: %', v_prep_area_zones;

  -- ✅ FIX: ดึง location_ids ทั้งหมดที่อยู่ใน preparation area zones
  SELECT ARRAY_AGG(location_id) INTO v_prep_area_location_ids
  FROM master_location
  WHERE warehouse_id = p_warehouse_id
    AND zone = ANY(v_prep_area_zones);

  RAISE NOTICE '📍 Preparation area location count: %', COALESCE(ARRAY_LENGTH(v_prep_area_location_ids, 1), 0);

  IF v_prep_area_location_ids IS NULL OR ARRAY_LENGTH(v_prep_area_location_ids, 1) = 0 THEN
    RAISE WARNING '⚠️ No preparation area locations found!';
    RETURN QUERY SELECT false, 0, 0, 'No preparation area locations found';
    RETURN;
  END IF;

  -- ดึงรายการสินค้าทั้งหมดที่ต้องจอง
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
    -- ✅ FIX: จำกัดให้จองจาก preparation area locations เท่านั้น
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
        -- ✅ FIX: จำกัดให้จองจาก preparation area locations เท่านั้น
        AND location_id = ANY(v_prep_area_location_ids)
        -- ถ้ามี source_location_id ให้ใช้ ถ้าไม่มีให้ query ทุก prep area location
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

      RAISE NOTICE '    ✅ Reserve from balance % (location %): %.3f pieces (%.3f packs)',
        v_balance.balance_id, v_balance.location_id, v_qty_to_reserve, v_pack_to_reserve;

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
      RAISE WARNING '⚠️  Item % (SKU %): Reserved only %.3f/%.3f pieces (shortage: %.3f) - check preparation area stock',
        v_item.id, v_item.sku_id, (v_item.quantity_to_pick - v_remaining_qty),
        v_item.quantity_to_pick, v_remaining_qty;
    END IF;
  END LOOP;

  -- สรุปผล
  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve (check sku_id and quantity_to_pick)';
  ELSIF v_items_reserved = v_items_count THEN
    RETURN QUERY SELECT true, v_items_reserved, v_items_count,
      format('Reserved %s/%s items successfully from preparation areas', v_items_reserved, v_items_count);
  ELSE
    RETURN QUERY SELECT false, v_items_reserved, v_items_count,
      format('Partial reservation: %s/%s items (check preparation area stock availability)', v_items_reserved, v_items_count);
  END IF;

  RAISE NOTICE '✅ Reservation complete: %/%', v_items_reserved, v_items_count;
END;
$func$;

-- Add comment
COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
  'จองสต็อคสำหรับ Bonus Face Sheet Items (FEFO+FIFO) - จำกัดให้จองจาก preparation areas เท่านั้น';

-- Log completion
DO $log$
BEGIN
  RAISE NOTICE '✅ Migration 188 completed: Fixed reservation function to use preparation areas only';
  RAISE NOTICE '   Function: reserve_stock_for_bonus_face_sheet_items()';
  RAISE NOTICE '   Fix: Only reserve from locations in preparation_area zones';
  RAISE NOTICE '   Excluded: Dispatch, Delivery-In-Progress, Expired, etc.';
END $log$;

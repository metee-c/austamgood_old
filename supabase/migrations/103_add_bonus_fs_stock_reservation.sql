-- Migration: 103_add_bonus_fs_stock_reservation.sql
-- Description: สร้าง function สำหรับจองสต็อคของรายการสินค้าในใบปะหน้าของแถม (FEFO + FIFO)
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Stock Reservation System
-- Logic: Copy 100% from face_sheet reservation function

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
  v_prep_area RECORD;
  v_location RECORD;
  v_balance RECORD;
  v_items_count INTEGER := 0;
  v_items_reserved INTEGER := 0;
  v_location_ids TEXT[];
  v_remaining_qty NUMERIC;
  v_qty_to_reserve NUMERIC;
  v_pack_to_reserve NUMERIC;
  v_qty_per_pack NUMERIC;
  v_available_qty NUMERIC;
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

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
      AND bfsi.source_location_id IS NOT NULL
    ORDER BY bfsi.id
  LOOP
    v_items_count := v_items_count + 1;
    v_qty_per_pack := v_item.qty_per_pack;

    RAISE NOTICE '  📝 Processing item %: SKU=%, Qty=%, Source=%',
      v_item.id, v_item.sku_id, v_item.quantity_to_pick, v_item.source_location_id;

    -- Step 1: Map preparation area → zone
    SELECT zone INTO v_prep_area
    FROM preparation_area
    WHERE area_code = v_item.source_location_id;

    IF v_prep_area.zone IS NULL THEN
      RAISE WARNING '  ⚠️  Preparation area not found: %', v_item.source_location_id;
      CONTINUE;
    END IF;

    RAISE NOTICE '  🗺️  Mapped to zone: %', v_prep_area.zone;

    -- Step 2: Get all location_ids in the zone
    SELECT ARRAY_AGG(location_id) INTO v_location_ids
    FROM master_location
    WHERE zone = v_prep_area.zone
      AND warehouse_id = p_warehouse_id;

    IF v_location_ids IS NULL OR ARRAY_LENGTH(v_location_ids, 1) = 0 THEN
      RAISE WARNING '  ⚠️  No locations found in zone: %', v_prep_area.zone;
      CONTINUE;
    END IF;

    RAISE NOTICE '  📍 Found % locations in zone', ARRAY_LENGTH(v_location_ids, 1);

    -- Step 3: Check total available stock
    SELECT SUM(total_piece_qty - reserved_piece_qty) INTO v_available_qty
    FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
      AND location_id = ANY(v_location_ids)
      AND sku_id = v_item.sku_id
      AND (total_piece_qty - reserved_piece_qty) > 0;

    v_available_qty := COALESCE(v_available_qty, 0);

    IF v_available_qty < v_item.quantity_to_pick THEN
      RAISE WARNING '  ❌ Insufficient stock: need=%, available=%',
        v_item.quantity_to_pick, v_available_qty;
      CONTINUE;
    END IF;

    -- Step 4: Reserve stock (FEFO + FIFO)
    v_remaining_qty := v_item.quantity_to_pick;

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
        lot_no
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND location_id = ANY(v_location_ids)
        AND sku_id = v_item.sku_id
        AND (total_piece_qty - reserved_piece_qty) > 0
      ORDER BY
        expiry_date ASC NULLS LAST,      -- FEFO: First Expiry First Out
        production_date ASC NULLS LAST,  -- FIFO: First In First Out
        created_at ASC                   -- FIFO: เก่าสุดก่อน
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      -- คำนวณจำนวนที่จะจอง
      v_qty_to_reserve := LEAST(
        v_balance.total_piece_qty - v_balance.reserved_piece_qty,
        v_remaining_qty
      );

      v_pack_to_reserve := v_qty_to_reserve / v_qty_per_pack;

      RAISE NOTICE '    🔒 Reserving: balance=%, qty=%, pack=%',
        v_balance.balance_id, v_qty_to_reserve, v_pack_to_reserve;

      -- อัปเดต reserved_piece_qty ใน wms_inventory_balances
      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
        reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
        updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

      -- บันทึกการจองใน bonus_face_sheet_item_reservations
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
    END LOOP;

    -- Check if fully reserved
    IF v_remaining_qty <= 0 THEN
      v_items_reserved := v_items_reserved + 1;
      RAISE NOTICE '  ✅ Item % fully reserved', v_item.id;
    ELSE
      RAISE WARNING '  ⚠️  Item % partially reserved: remaining=%', v_item.id, v_remaining_qty;
    END IF;
  END LOOP;

  -- Return result
  RAISE NOTICE '🎉 Reservation complete: %/% items reserved', v_items_reserved, v_items_count;

  RETURN QUERY SELECT
    TRUE,
    v_items_reserved,
    v_items_count,
    format('Reserved stock for %s/%s items', v_items_reserved, v_items_count);
END;
$$;

-- Add comments
COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS 'จองสต็อคสำหรับรายการสินค้าในใบปะหน้าของแถม ใช้ FEFO (First Expiry First Out) + FIFO (First In First Out)';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 103 completed: Created reserve_stock_for_bonus_face_sheet_items function';
END $$;

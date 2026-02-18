-- ============================================
-- Migration: เพิ่ม SKU Fallback สำหรับรหัสสินค้าที่ลงท้ายด้วย "010"
-- Reason: ถ้า SKU ลงท้ายด้วย "010" ไม่มีสต็อก ให้ลองหา "NS|010" แทน
-- Example: B-BEY-C|LAM|010 → B-BEY-C|LAM|NS|010
-- ============================================

CREATE OR REPLACE FUNCTION public.reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id bigint,
  p_warehouse_id character varying DEFAULT 'WH001'::character varying,
  p_reserved_by character varying DEFAULT 'System'::character varying
)
RETURNS TABLE(
  success boolean,
  items_reserved integer,
  items_total integer,
  message text,
  insufficient_stock_items jsonb
)
LANGUAGE plpgsql
AS $function$
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
  v_face_sheet_no VARCHAR;
  v_current_sku VARCHAR;
  v_fallback_sku VARCHAR;
  v_insufficient_items JSONB := '[]'::JSONB;
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

  -- ดึง face_sheet_no
  SELECT face_sheet_no INTO v_face_sheet_no
  FROM bonus_face_sheets
  WHERE id = p_bonus_face_sheet_id;

  -- ดึง zones ทั้งหมดจาก preparation_area table
  SELECT ARRAY_AGG(DISTINCT zone) INTO v_prep_area_zones
  FROM preparation_area
  WHERE zone IS NOT NULL;

  RAISE NOTICE '📍 Preparation area zones: %', v_prep_area_zones;

  -- ดึง location_ids ทั้งหมดที่อยู่ใน preparation area zones
  SELECT ARRAY_AGG(location_id) INTO v_prep_area_location_ids
  FROM master_location
  WHERE warehouse_id = p_warehouse_id
    AND zone = ANY(v_prep_area_zones);

  RAISE NOTICE '📍 Preparation area location count: %', COALESCE(ARRAY_LENGTH(v_prep_area_location_ids, 1), 0);

  IF v_prep_area_location_ids IS NULL OR ARRAY_LENGTH(v_prep_area_location_ids, 1) = 0 THEN
    RAISE WARNING '⚠️ No preparation area locations found!';
    RETURN QUERY SELECT false, 0, 0, 'No preparation area locations found', '[]'::JSONB;
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
    v_current_sku := v_item.sku_id;

    RAISE NOTICE '  📋 Item %: SKU=%, qty=%, location=%', v_item.id, v_current_sku, v_remaining_qty, v_item.source_location_id;

    -- ✅ NEW: SKU Fallback Logic
    -- ถ้า SKU ลงท้ายด้วย "010" และไม่ใช่ "NS|010" อยู่แล้ว → สร้าง fallback SKU
    v_fallback_sku := NULL;
    IF v_current_sku LIKE '%|010' AND v_current_sku NOT LIKE '%|NS|010' THEN
      -- แทนที่ส่วนท้ายจาก "|010" เป็น "|NS|010"
      v_fallback_sku := REGEXP_REPLACE(v_current_sku, '\|010$', '|NS|010');
      RAISE NOTICE '  🔄 Fallback SKU detected: % → %', v_current_sku, v_fallback_sku;
    END IF;

    -- ลอง query balances จาก SKU หลัก
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
        AND sku_id = v_current_sku
        AND (total_piece_qty - COALESCE(reserved_piece_qty, 0)) > 0
        AND location_id = ANY(v_prep_area_location_ids)
        AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC NULLS LAST,
        production_date ASC NULLS LAST,
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

      RAISE NOTICE '    ✅ Reserve from balance % (location %): %.3f pieces (%.3f packs) [SKU: %]',
        v_balance.balance_id, v_balance.location_id, v_qty_to_reserve, v_pack_to_reserve, v_current_sku;

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
        EXIT;
      END IF;
    END LOOP;

    -- ✅ NEW: ถ้ายังจองไม่ครบ และมี fallback SKU → ลองหาจาก fallback SKU
    IF v_remaining_qty > 0 AND v_fallback_sku IS NOT NULL THEN
      RAISE NOTICE '  🔍 Trying fallback SKU: %', v_fallback_sku;

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
          AND sku_id = v_fallback_sku
          AND (total_piece_qty - COALESCE(reserved_piece_qty, 0)) > 0
          AND location_id = ANY(v_prep_area_location_ids)
          AND (v_item.source_location_id IS NULL OR location_id = v_item.source_location_id)
        ORDER BY
          CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
          expiry_date ASC NULLS LAST,
          production_date ASC NULLS LAST,
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

        RAISE NOTICE '    ✅ Reserve from balance % (location %): %.3f pieces (%.3f packs) [FALLBACK SKU: %]',
          v_balance.balance_id, v_balance.location_id, v_qty_to_reserve, v_pack_to_reserve, v_fallback_sku;

        -- Update balance
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
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- ถ้ายังจองไม่ครบ → บันทึกเป็น insufficient item
    IF v_remaining_qty > 0 THEN
      RAISE NOTICE '    🔴 INSUFFICIENT STOCK: %.3f pieces short for SKU % (tried fallback: %)',
        v_remaining_qty, v_current_sku, COALESCE(v_fallback_sku, 'none');

      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'sku_id', v_current_sku,
        'fallback_sku', v_fallback_sku,
        'shortage', v_remaining_qty
      );
    ELSE
      v_items_reserved := v_items_reserved + 1;
    END IF;
  END LOOP;

  -- ตรวจสอบผลลัพธ์
  IF jsonb_array_length(v_insufficient_items) > 0 THEN
    RAISE NOTICE '    ❌ Cannot create bonus face sheet - insufficient stock for % items', jsonb_array_length(v_insufficient_items);

    -- Rollback all reservations
    DELETE FROM bonus_face_sheet_item_reservations
    WHERE bonus_face_sheet_item_id IN (
      SELECT id FROM bonus_face_sheet_items WHERE face_sheet_id = p_bonus_face_sheet_id
    );

    UPDATE wms_inventory_balances
    SET reserved_piece_qty = 0, reserved_pack_qty = 0
    WHERE balance_id IN (
      SELECT balance_id FROM bonus_face_sheet_item_reservations
      WHERE bonus_face_sheet_item_id IN (
        SELECT id FROM bonus_face_sheet_items WHERE face_sheet_id = p_bonus_face_sheet_id
      )
    );

    RETURN QUERY SELECT
      false,
      0,
      v_items_count,
      'สต็อกในบ้านหยิบไม่เพียงพอ กรุณาเติมสต็อกก่อน',
      v_insufficient_items;
    RETURN;
  END IF;

  -- สรุปผล - จองสำเร็จทุกรายการ
  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve (check sku_id and quantity_to_pick)', '[]'::JSONB;
  ELSE
    RETURN QUERY SELECT true, v_items_reserved, v_items_count,
      format('Reserved %s/%s items successfully (with SKU fallback support)', v_items_reserved, v_items_count),
      '[]'::JSONB;
  END IF;

  RAISE NOTICE '✅ Reservation complete: %/% items (with SKU fallback support)', v_items_reserved, v_items_count;
END;
$function$;

-- ============================================
-- Add comment
-- ============================================
COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
'Reserve stock for bonus face sheet items from PREPARATION AREAS ONLY.
NEW: Supports SKU fallback for |010 suffix → |NS|010
Example: B-BEY-C|LAM|010 → B-BEY-C|LAM|NS|010
Will fail if insufficient stock even after fallback.';

-- ============================================
-- Log completion
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 251 completed: Added SKU fallback for 010 suffix (|010 → |NS|010)';
END $$;

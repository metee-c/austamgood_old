-- ============================================================================
-- Migration: 303_improve_bonus_fs_insufficient_stock_message.sql
-- Description: ปรับปรุงการแจ้งเตือนเมื่อสต็อกไม่พอในการสร้าง Bonus Face Sheet
-- 
-- ปัญหา: เมื่อสต็อกไม่พอ ระบบจะสร้าง Virtual Pallet แต่ไม่แจ้งรายละเอียดว่า SKU ไหนไม่พอ
-- 
-- แก้ไข: เพิ่ม insufficient_stock_items ใน return value เพื่อแจ้งรายละเอียด
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_stock_for_bonus_face_sheet_items(
  p_bonus_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR DEFAULT 'WH001',
  p_reserved_by VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
  success BOOLEAN,
  items_reserved INTEGER,
  items_total INTEGER,
  message TEXT,
  insufficient_stock_items JSONB
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
  v_prep_area_zones TEXT[];
  v_prep_area_location_ids TEXT[];
  v_virtual_pallet_id VARCHAR;
  v_virtual_balance_id BIGINT;
  v_face_sheet_no VARCHAR;
  v_insufficient_items JSONB := '[]'::JSONB;
  v_initial_remaining_qty NUMERIC;
  v_sku_name TEXT;
BEGIN
  RAISE NOTICE '📦 Starting stock reservation for bonus face sheet %', p_bonus_face_sheet_id;

  -- ดึง face_sheet_no สำหรับสร้าง Virtual Pallet
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
      bfsi.product_name,
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
    v_initial_remaining_qty := v_remaining_qty;
    v_qty_per_pack := v_item.qty_per_pack;
    v_sku_name := v_item.product_name;

    RAISE NOTICE '  📋 Item %: SKU=%, qty=%, location=%', v_item.id, v_item.sku_id, v_remaining_qty, v_item.source_location_id;

    -- Query balances with FEFO + FIFO
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
        EXIT;
      END IF;
    END LOOP;

    -- ✅ ถ้าจองไม่ครบ ให้สร้าง Virtual Pallet และบันทึกรายการที่ขาด
    IF v_remaining_qty > 0 THEN
      RAISE NOTICE '    🔴 Shortage detected: %.3f pieces - creating Virtual Pallet', v_remaining_qty;
      
      -- เพิ่มรายการที่สต็อกไม่พอ
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'sku_id', v_item.sku_id,
        'product_name', v_sku_name,
        'required_qty', v_initial_remaining_qty,
        'available_qty', v_initial_remaining_qty - v_remaining_qty,
        'shortage_qty', v_remaining_qty
      );
      
      -- สร้าง Virtual Pallet ID
      v_virtual_pallet_id := 'VIRT-BFS-' || v_face_sheet_no || '-' || v_item.sku_id;
      
      -- ตรวจสอบว่ามี Virtual Balance อยู่แล้วหรือไม่
      SELECT balance_id INTO v_virtual_balance_id
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND sku_id = v_item.sku_id
        AND pallet_id = v_virtual_pallet_id
        AND location_id = 'VIRTUAL-PALLET';
      
      -- ถ้าไม่มี ให้สร้างใหม่
      IF v_virtual_balance_id IS NULL THEN
        INSERT INTO wms_inventory_balances (
          warehouse_id,
          sku_id,
          location_id,
          pallet_id,
          lot_no,
          production_date,
          expiry_date,
          total_piece_qty,
          reserved_piece_qty,
          total_pack_qty,
          reserved_pack_qty,
          created_at,
          updated_at
        ) VALUES (
          p_warehouse_id,
          v_item.sku_id,
          'VIRTUAL-PALLET',
          v_virtual_pallet_id,
          'VIRTUAL',
          CURRENT_DATE,
          NULL,
          0,  -- เริ่มต้นที่ 0
          v_remaining_qty,  -- จองติดลบ
          0,
          v_remaining_qty / v_qty_per_pack,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING balance_id INTO v_virtual_balance_id;
        
        RAISE NOTICE '    ✅ Created Virtual Pallet: % (balance_id: %)', v_virtual_pallet_id, v_virtual_balance_id;
      ELSE
        -- ถ้ามีอยู่แล้ว ให้ update reserved_piece_qty
        UPDATE wms_inventory_balances
        SET
          reserved_piece_qty = COALESCE(reserved_piece_qty, 0) + v_remaining_qty,
          reserved_pack_qty = COALESCE(reserved_pack_qty, 0) + (v_remaining_qty / v_qty_per_pack),
          updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_virtual_balance_id;
        
        RAISE NOTICE '    ✅ Updated Virtual Pallet: % (balance_id: %)', v_virtual_pallet_id, v_virtual_balance_id;
      END IF;
      
      -- Insert reservation record สำหรับ Virtual Pallet
      INSERT INTO bonus_face_sheet_item_reservations (
        bonus_face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        reserved_by,
        status
      ) VALUES (
        v_item.id,
        v_virtual_balance_id,
        v_remaining_qty,
        v_remaining_qty / v_qty_per_pack,
        p_reserved_by,
        'reserved'
      );
      
      RAISE NOTICE '    ✅ Reserved %.3f pieces from Virtual Pallet', v_remaining_qty;
    END IF;
    
    -- นับว่าจองสำเร็จ (รวม Virtual Pallet)
    v_items_reserved := v_items_reserved + 1;
  END LOOP;

  -- สรุปผล - ตอนนี้จองได้ทุกรายการแล้ว (รวม Virtual Pallet)
  IF v_items_count = 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'No items to reserve (check sku_id and quantity_to_pick)', '[]'::JSONB;
  ELSE
    -- ถ้ามี SKU ที่สต็อกไม่พอ ให้แจ้งเตือน
    IF jsonb_array_length(v_insufficient_items) > 0 THEN
      RETURN QUERY SELECT 
        true, 
        v_items_reserved, 
        v_items_count,
        format('⚠️ สร้างใบปะหน้าสำเร็จ แต่มี %s รายการที่สต็อกไม่พอ (ใช้ Virtual Pallet)', jsonb_array_length(v_insufficient_items)),
        v_insufficient_items;
    ELSE
      RETURN QUERY SELECT 
        true, 
        v_items_reserved, 
        v_items_count,
        format('Reserved %s/%s items successfully', v_items_reserved, v_items_count),
        '[]'::JSONB;
    END IF;
  END IF;

  RAISE NOTICE '✅ Reservation complete: %/% (with Virtual Pallets)', v_items_reserved, v_items_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION reserve_stock_for_bonus_face_sheet_items IS
  'จองสต็อคสำหรับ Bonus Face Sheet Items (FEFO+FIFO) - รองรับ Virtual Pallet และแจ้งรายละเอียด SKU ที่สต็อกไม่พอ (Migration 303)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_stock_for_bonus_face_sheet_items TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================================
-- Migration: Add stock reservation to face sheet creation
-- Description: เพิ่มการจองสต็อคอัตโนมัติเมื่อสร้าง face sheet
-- ============================================================================

-- สร้าง function สำหรับจองสต็อคของ face sheet items
CREATE OR REPLACE FUNCTION reserve_stock_for_face_sheet_items(
  p_face_sheet_id BIGINT,
  p_warehouse_id VARCHAR(50),
  p_created_by VARCHAR(100)
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  items_reserved INTEGER,
  insufficient_stock_items JSONB
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_sku_info RECORD;
  v_prep_area RECORD;
  v_location_ids TEXT[];
  v_balance RECORD;
  v_remaining_qty NUMERIC;
  v_available_qty NUMERIC;
  v_qty_to_reserve NUMERIC;
  v_pack_to_reserve NUMERIC;
  v_items_reserved INTEGER := 0;
  v_insufficient_items JSONB := '[]'::JSONB;
  v_has_insufficient BOOLEAN := FALSE;
BEGIN
  -- Loop through all face_sheet_items
  FOR v_item IN (
    SELECT 
      fsi.id,
      fsi.sku_id,
      fsi.product_code,
      fsi.quantity,
      fsi.quantity_to_pick
    FROM face_sheet_items fsi
    WHERE fsi.face_sheet_id = p_face_sheet_id
  )
  LOOP
    -- Get SKU info and default_location
    SELECT 
      sku_id,
      sku_name,
      default_location,
      qty_per_pack,
      uom_base
    INTO v_sku_info
    FROM master_sku
    WHERE sku_id = COALESCE(v_item.sku_id, v_item.product_code);
    
    IF NOT FOUND THEN
      RAISE NOTICE 'SKU not found: %', COALESCE(v_item.sku_id, v_item.product_code);
      CONTINUE;
    END IF;
    
    -- Check if SKU has default_location
    IF v_sku_info.default_location IS NULL THEN
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'sku_id', v_sku_info.sku_id,
        'sku_name', v_sku_info.sku_name,
        'reason', 'SKU does not have preparation area (default_location) configured'
      );
      v_has_insufficient := TRUE;
      CONTINUE;
    END IF;
    
    -- Update face_sheet_item with sku_id and source_location_id
    UPDATE face_sheet_items
    SET 
      sku_id = v_sku_info.sku_id,
      source_location_id = v_sku_info.default_location,
      quantity_to_pick = COALESCE(quantity_to_pick, quantity),
      uom = v_sku_info.uom_base,
      status = 'pending'
    WHERE id = v_item.id;
    
    -- Map preparation area → zone → locations
    SELECT zone INTO v_prep_area
    FROM preparation_area
    WHERE area_code = v_sku_info.default_location;
    
    IF FOUND AND v_prep_area.zone IS NOT NULL THEN
      -- Get all location_ids in this zone
      SELECT ARRAY_AGG(location_id)
      INTO v_location_ids
      FROM master_location
      WHERE zone = v_prep_area.zone
        AND warehouse_id = p_warehouse_id;
    ELSE
      -- Fallback: use default_location as direct location_id
      v_location_ids := ARRAY[v_sku_info.default_location];
    END IF;
    
    -- Check total available stock
    SELECT COALESCE(SUM(total_piece_qty - reserved_piece_qty), 0)
    INTO v_available_qty
    FROM wms_inventory_balances
    WHERE warehouse_id = p_warehouse_id
      AND location_id = ANY(v_location_ids)
      AND sku_id = v_sku_info.sku_id
      AND total_piece_qty > 0;
    
    -- Check if sufficient stock
    IF v_available_qty < COALESCE(v_item.quantity_to_pick, v_item.quantity) THEN
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'sku_id', v_sku_info.sku_id,
        'sku_name', v_sku_info.sku_name,
        'zone', v_sku_info.default_location,
        'required', COALESCE(v_item.quantity_to_pick, v_item.quantity),
        'available', v_available_qty,
        'shortage', COALESCE(v_item.quantity_to_pick, v_item.quantity) - v_available_qty
      );
      v_has_insufficient := TRUE;
      CONTINUE;
    END IF;
    
    -- Reserve stock using FEFO/FIFO
    v_remaining_qty := COALESCE(v_item.quantity_to_pick, v_item.quantity);
    
    FOR v_balance IN (
      SELECT 
        balance_id,
        location_id,
        total_piece_qty,
        reserved_piece_qty,
        total_pack_qty,
        reserved_pack_qty,
        expiry_date,
        production_date
      FROM wms_inventory_balances
      WHERE warehouse_id = p_warehouse_id
        AND location_id = ANY(v_location_ids)
        AND sku_id = v_sku_info.sku_id
        AND total_piece_qty > 0
      ORDER BY 
        expiry_date ASC NULLS LAST,
        production_date ASC NULLS LAST,
        created_at ASC
    )
    LOOP
      EXIT WHEN v_remaining_qty <= 0;
      
      v_available_qty := v_balance.total_piece_qty - v_balance.reserved_piece_qty;
      CONTINUE WHEN v_available_qty <= 0;
      
      v_qty_to_reserve := LEAST(v_available_qty, v_remaining_qty);
      v_pack_to_reserve := v_qty_to_reserve / COALESCE(v_sku_info.qty_per_pack, 1);
      
      -- Update inventory balance
      UPDATE wms_inventory_balances
      SET 
        reserved_piece_qty = reserved_piece_qty + v_qty_to_reserve,
        reserved_pack_qty = reserved_pack_qty + v_pack_to_reserve,
        updated_at = NOW()
      WHERE balance_id = v_balance.balance_id;
      
      -- Insert reservation record
      INSERT INTO face_sheet_item_reservations (
        face_sheet_item_id,
        balance_id,
        reserved_piece_qty,
        reserved_pack_qty,
        reserved_by,
        status,
        created_at,
        updated_at
      ) VALUES (
        v_item.id,
        v_balance.balance_id,
        v_qty_to_reserve,
        v_pack_to_reserve,
        p_created_by,
        'reserved',
        NOW(),
        NOW()
      );
      
      v_remaining_qty := v_remaining_qty - v_qty_to_reserve;
    END LOOP;
    
    -- Check if fully reserved
    IF v_remaining_qty > 0 THEN
      v_insufficient_items := v_insufficient_items || jsonb_build_object(
        'sku_id', v_sku_info.sku_id,
        'sku_name', v_sku_info.sku_name,
        'reason', 'Could not reserve full quantity',
        'required', COALESCE(v_item.quantity_to_pick, v_item.quantity),
        'reserved', COALESCE(v_item.quantity_to_pick, v_item.quantity) - v_remaining_qty,
        'shortage', v_remaining_qty
      );
      v_has_insufficient := TRUE;
    ELSE
      v_items_reserved := v_items_reserved + 1;
    END IF;
  END LOOP;
  
  -- Return results
  IF v_has_insufficient THEN
    RETURN QUERY SELECT 
      FALSE,
      'Insufficient stock for some items'::TEXT,
      v_items_reserved,
      v_insufficient_items;
  ELSE
    RETURN QUERY SELECT 
      TRUE,
      'Stock reserved successfully'::TEXT,
      v_items_reserved,
      '[]'::JSONB;
  END IF;
END;
$$;

COMMENT ON FUNCTION reserve_stock_for_face_sheet_items IS 'จองสต็อคสำหรับ face sheet items โดยใช้ FEFO/FIFO';

-- สร้าง trigger function ที่จะเรียก reserve_stock_for_face_sheet_items หลังจากสร้าง face sheet
CREATE OR REPLACE FUNCTION trigger_reserve_stock_after_face_sheet_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- เรียก function จองสต็อค
  SELECT * INTO v_result
  FROM reserve_stock_for_face_sheet_items(
    NEW.id,
    NEW.warehouse_id,
    NEW.created_by
  );
  
  -- Log ผลลัพธ์
  IF v_result.success THEN
    RAISE NOTICE 'Stock reserved for face sheet %: % items', NEW.face_sheet_no, v_result.items_reserved;
  ELSE
    RAISE WARNING 'Stock reservation failed for face sheet %: %', NEW.face_sheet_no, v_result.message;
    RAISE WARNING 'Insufficient items: %', v_result.insufficient_stock_items;
  END IF;
  
  RETURN NEW;
END;
$$;

-- สร้าง trigger (แต่ปิดไว้ก่อน เพราะต้องทดสอบก่อน)
-- DROP TRIGGER IF EXISTS trigger_after_face_sheet_insert ON face_sheets;
-- CREATE TRIGGER trigger_after_face_sheet_insert
--   AFTER INSERT ON face_sheets
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_reserve_stock_after_face_sheet_created();

COMMENT ON FUNCTION trigger_reserve_stock_after_face_sheet_created IS 'Trigger function: จองสต็อคอัตโนมัติหลังจากสร้าง face sheet';

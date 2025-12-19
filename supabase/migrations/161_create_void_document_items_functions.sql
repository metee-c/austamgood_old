-- ============================================================================
-- Migration: Create Void Document Items Functions
-- Description: Functions สำหรับ Void Document Items ของ Order
-- ============================================================================

-- Function: Void Order Picklist Items
CREATE OR REPLACE FUNCTION void_order_picklist_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_items_voided INT := 0;
  v_affected_picklist_ids BIGINT[];
BEGIN
  -- Get affected picklist IDs
  SELECT ARRAY_AGG(DISTINCT picklist_id)
  INTO v_affected_picklist_ids
  FROM picklist_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL;

  -- Void items
  UPDATE picklist_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_id = p_order_id
    AND voided_at IS NULL;
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'affected_picklist_ids', COALESCE(v_affected_picklist_ids, ARRAY[]::BIGINT[])
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Void Order Face Sheet Items
CREATE OR REPLACE FUNCTION void_order_face_sheet_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_items_voided INT := 0;
  v_affected_face_sheet_ids BIGINT[];
BEGIN
  -- Get affected face sheet IDs
  SELECT ARRAY_AGG(DISTINCT face_sheet_id)
  INTO v_affected_face_sheet_ids
  FROM face_sheet_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL;

  -- Void items
  UPDATE face_sheet_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_id = p_order_id
    AND voided_at IS NULL;
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'affected_face_sheet_ids', COALESCE(v_affected_face_sheet_ids, ARRAY[]::BIGINT[])
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Void Order Bonus Face Sheet Items
CREATE OR REPLACE FUNCTION void_order_bonus_face_sheet_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_items_voided INT := 0;
  v_affected_bonus_face_sheet_ids BIGINT[];
  v_order_item_ids BIGINT[];
BEGIN
  -- Get order_item_ids for this order
  SELECT ARRAY_AGG(order_item_id)
  INTO v_order_item_ids
  FROM wms_order_items
  WHERE order_id = p_order_id;

  IF v_order_item_ids IS NULL OR array_length(v_order_item_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'items_voided', 0,
      'affected_bonus_face_sheet_ids', ARRAY[]::BIGINT[]
    );
  END IF;

  -- Get affected bonus face sheet IDs
  SELECT ARRAY_AGG(DISTINCT face_sheet_id)
  INTO v_affected_bonus_face_sheet_ids
  FROM bonus_face_sheet_items
  WHERE order_item_id = ANY(v_order_item_ids)
    AND voided_at IS NULL;

  -- Void items
  UPDATE bonus_face_sheet_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_item_id = ANY(v_order_item_ids)
    AND voided_at IS NULL;
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'affected_bonus_face_sheet_ids', COALESCE(v_affected_bonus_face_sheet_ids, ARRAY[]::BIGINT[])
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Remove Order Loadlist Items
CREATE OR REPLACE FUNCTION remove_order_loadlist_items(
  p_order_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_items_removed INT := 0;
  v_affected_loadlist_ids BIGINT[];
BEGIN
  -- Get affected loadlist IDs
  SELECT ARRAY_AGG(DISTINCT loadlist_id)
  INTO v_affected_loadlist_ids
  FROM loadlist_items
  WHERE order_id = p_order_id;

  -- Delete items (loadlist_items doesn't have voided_at)
  DELETE FROM loadlist_items
  WHERE order_id = p_order_id;
  
  GET DIAGNOSTICS v_items_removed = ROW_COUNT;

  RETURN jsonb_build_object(
    'items_removed', v_items_removed,
    'affected_loadlist_ids', COALESCE(v_affected_loadlist_ids, ARRAY[]::BIGINT[])
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Remove Order from Route
CREATE OR REPLACE FUNCTION remove_order_from_route(
  p_order_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_stops_removed INT := 0;
  v_affected_trip_ids BIGINT[];
BEGIN
  -- Get affected trip IDs
  SELECT ARRAY_AGG(DISTINCT trip_id)
  INTO v_affected_trip_ids
  FROM receiving_route_stops
  WHERE order_id = p_order_id;

  -- Delete route stops
  DELETE FROM receiving_route_stops
  WHERE order_id = p_order_id;
  
  GET DIAGNOSTICS v_stops_removed = ROW_COUNT;

  -- Delete route plan inputs
  DELETE FROM receiving_route_plan_inputs
  WHERE order_id = p_order_id;

  -- Clear matched_trip_id from order
  UPDATE wms_orders
  SET 
    matched_trip_id = NULL,
    auto_matched_at = NULL
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'stops_removed', v_stops_removed,
    'affected_trip_ids', COALESCE(v_affected_trip_ids, ARRAY[]::BIGINT[])
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Void Empty Parent Documents
CREATE OR REPLACE FUNCTION void_empty_parent_documents()
RETURNS JSONB AS $$
DECLARE
  v_picklists_voided INT := 0;
  v_face_sheets_voided INT := 0;
  v_bonus_face_sheets_voided INT := 0;
  v_loadlists_voided INT := 0;
BEGIN
  -- Void empty picklists
  UPDATE picklists
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM picklist_items pi
      WHERE pi.picklist_id = picklists.id
        AND (pi.voided_at IS NULL OR pi.status != 'voided')
    );
  GET DIAGNOSTICS v_picklists_voided = ROW_COUNT;

  -- Void empty face sheets
  UPDATE face_sheets
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM face_sheet_items fsi
      WHERE fsi.face_sheet_id = face_sheets.id
        AND (fsi.voided_at IS NULL OR fsi.status != 'voided')
    );
  GET DIAGNOSTICS v_face_sheets_voided = ROW_COUNT;

  -- Void empty bonus face sheets
  UPDATE bonus_face_sheets
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM bonus_face_sheet_items bfsi
      WHERE bfsi.face_sheet_id = bonus_face_sheets.id
        AND (bfsi.voided_at IS NULL OR bfsi.status != 'voided')
    );
  GET DIAGNOSTICS v_bonus_face_sheets_voided = ROW_COUNT;

  -- Void empty loadlists
  UPDATE loadlists
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM loadlist_items li
      WHERE li.loadlist_id = loadlists.id
    );
  GET DIAGNOSTICS v_loadlists_voided = ROW_COUNT;

  RETURN jsonb_build_object(
    'picklists_voided', v_picklists_voided,
    'face_sheets_voided', v_face_sheets_voided,
    'bonus_face_sheets_voided', v_bonus_face_sheets_voided,
    'loadlists_voided', v_loadlists_voided
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION void_order_picklist_items IS 'Void picklist items ของ Order';
COMMENT ON FUNCTION void_order_face_sheet_items IS 'Void face sheet items ของ Order';
COMMENT ON FUNCTION void_order_bonus_face_sheet_items IS 'Void bonus face sheet items ของ Order';
COMMENT ON FUNCTION remove_order_loadlist_items IS 'ลบ loadlist items ของ Order';
COMMENT ON FUNCTION remove_order_from_route IS 'ลบ Order ออกจาก Route';
COMMENT ON FUNCTION void_empty_parent_documents IS 'Void เอกสารที่ไม่มี items เหลือ';

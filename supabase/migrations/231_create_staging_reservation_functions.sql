-- Migration: 231_create_staging_reservation_functions.sql
-- Description: สร้าง database functions สำหรับจัดการ staging reservations
-- Date: 2025-01-18
-- Related to: Document Verification Loading System
-- Requirements: 1.5-1.9, 2.1-2.8, 3.1-3.4

-- ============================================================================
-- Function 1: create_staging_reservation_after_pick
-- ============================================================================
-- Purpose: สร้าง staging reservation หลังจากยืนยันการหยิบสินค้า
-- Parameters:
--   - p_document_type: 'picklist', 'face_sheet', 'bonus_face_sheet'
--   - p_document_item_id: ID ของ item ในเอกสาร
--   - p_sku_id: SKU ID
--   - p_quantity_piece: จำนวนชิ้น
--   - p_quantity_pack: จำนวนแพ็ค (optional, default 0)
--   - p_staging_location_id: Location ID ของ Dispatch/Staging
--   - p_balance_id: Inventory balance ID
-- Returns: JSON { success: boolean, message: string, reservation_id: integer }

CREATE OR REPLACE FUNCTION create_staging_reservation_after_pick(
  p_document_type TEXT,
  p_document_item_id INTEGER,
  p_sku_id TEXT,
  p_quantity_piece INTEGER,
  p_staging_location_id VARCHAR,
  p_balance_id INTEGER,
  p_quantity_pack INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation_id INTEGER;
  v_location_exists BOOLEAN;
  v_balance_exists BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_document_type NOT IN ('picklist', 'face_sheet', 'bonus_face_sheet') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid document_type: ' || p_document_type,
      'reservation_id', NULL
    );
  END IF;

  -- Check if staging_location_id exists
  SELECT EXISTS(
    SELECT 1 FROM master_location WHERE location_id = p_staging_location_id
  ) INTO v_location_exists;

  IF NOT v_location_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid staging_location_id: ' || p_staging_location_id,
      'reservation_id', NULL
    );
  END IF;

  -- Check if balance_id exists
  SELECT EXISTS(
    SELECT 1 FROM inventory_balances WHERE balance_id = p_balance_id
  ) INTO v_balance_exists;

  IF NOT v_balance_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid balance_id: ' || p_balance_id,
      'reservation_id', NULL
    );
  END IF;

  -- Insert staging reservation based on document type
  IF p_document_type = 'picklist' THEN
    INSERT INTO picklist_item_reservations (
      picklist_item_id,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      status,
      staging_location_id,
      created_at,
      updated_at
    ) VALUES (
      p_document_item_id,
      p_balance_id,
      p_quantity_piece,
      p_quantity_pack,
      'picked',
      p_staging_location_id,
      NOW(),
      NOW()
    )
    RETURNING reservation_id INTO v_reservation_id;

  ELSIF p_document_type = 'face_sheet' THEN
    INSERT INTO face_sheet_item_reservations (
      face_sheet_item_id,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      status,
      staging_location_id,
      created_at,
      updated_at
    ) VALUES (
      p_document_item_id,
      p_balance_id,
      p_quantity_piece,
      p_quantity_pack,
      'picked',
      p_staging_location_id,
      NOW(),
      NOW()
    )
    RETURNING reservation_id INTO v_reservation_id;

  ELSIF p_document_type = 'bonus_face_sheet' THEN
    INSERT INTO bonus_face_sheet_item_reservations (
      bonus_face_sheet_item_id,
      balance_id,
      reserved_piece_qty,
      reserved_pack_qty,
      status,
      staging_location_id,
      created_at,
      updated_at
    ) VALUES (
      p_document_item_id,
      p_balance_id,
      p_quantity_piece,
      p_quantity_pack,
      'picked',
      p_staging_location_id,
      NOW(),
      NOW()
    )
    RETURNING reservation_id INTO v_reservation_id;
  END IF;

  -- Update inventory_balances.reserved_piece_qty
  UPDATE inventory_balances
  SET 
    reserved_piece_qty = reserved_piece_qty + p_quantity_piece,
    reserved_pack_qty = reserved_pack_qty + p_quantity_pack,
    updated_at = NOW()
  WHERE balance_id = p_balance_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Staging reservation created successfully',
    'reservation_id', v_reservation_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating staging reservation: ' || SQLERRM,
      'reservation_id', NULL
    );
END;
$$;

COMMENT ON FUNCTION create_staging_reservation_after_pick IS 
  'สร้าง staging reservation หลังจากยืนยันการหยิบสินค้า - Requirements 1.5-1.9';

-- ============================================================================
-- Function 2: validate_staging_reservations
-- ============================================================================
-- Purpose: ตรวจสอบ staging reservation ก่อนโหลด
-- Parameters:
--   - p_document_type: 'picklist', 'face_sheet', 'bonus_face_sheet'
--   - p_document_ids: Array ของ document IDs
--   - p_staging_location_ids: Array ของ staging location IDs (สำหรับ bonus face sheet)
-- Returns: JSON { valid: boolean, message: string, missing_items: array }

CREATE OR REPLACE FUNCTION validate_staging_reservations(
  p_document_type TEXT,
  p_document_ids INTEGER[],
  p_staging_location_ids VARCHAR[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_required INTEGER;
  v_total_reserved INTEGER;
  v_missing_items JSON;
BEGIN
  -- Validate document type
  IF p_document_type NOT IN ('picklist', 'face_sheet', 'bonus_face_sheet') THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Invalid document_type: ' || p_document_type,
      'missing_items', '[]'::json
    );
  END IF;

  -- Validate based on document type
  IF p_document_type = 'picklist' THEN
    -- Check picklist items
    WITH required_items AS (
      SELECT 
        pi.id as document_item_id,
        pi.sku_id,
        pi.quantity_piece as required_qty
      FROM picklist_items pi
      JOIN picklists p ON p.id = pi.picklist_id
      WHERE p.id = ANY(p_document_ids)
    ),
    reserved_items AS (
      SELECT 
        pir.picklist_item_id as document_item_id,
        SUM(pir.reserved_piece_qty) as reserved_qty
      FROM picklist_item_reservations pir
      WHERE pir.picklist_item_id IN (SELECT document_item_id FROM required_items)
        AND pir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR pir.staging_location_id = ANY(p_staging_location_ids))
      GROUP BY pir.picklist_item_id
    )
    SELECT 
      json_agg(
        json_build_object(
          'document_item_id', r.document_item_id,
          'sku_id', r.sku_id,
          'required_qty', r.required_qty,
          'reserved_qty', COALESCE(res.reserved_qty, 0)
        )
      )
    INTO v_missing_items
    FROM required_items r
    LEFT JOIN reserved_items res ON res.document_item_id = r.document_item_id
    WHERE COALESCE(res.reserved_qty, 0) < r.required_qty;

  ELSIF p_document_type = 'face_sheet' THEN
    -- Check face sheet items
    WITH required_items AS (
      SELECT 
        fsi.id as document_item_id,
        fsi.sku_id,
        fsi.quantity_piece as required_qty
      FROM face_sheet_items fsi
      JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
      WHERE fs.id = ANY(p_document_ids)
    ),
    reserved_items AS (
      SELECT 
        fsir.face_sheet_item_id as document_item_id,
        SUM(fsir.reserved_piece_qty) as reserved_qty
      FROM face_sheet_item_reservations fsir
      WHERE fsir.face_sheet_item_id IN (SELECT document_item_id FROM required_items)
        AND fsir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR fsir.staging_location_id = ANY(p_staging_location_ids))
      GROUP BY fsir.face_sheet_item_id
    )
    SELECT 
      json_agg(
        json_build_object(
          'document_item_id', r.document_item_id,
          'sku_id', r.sku_id,
          'required_qty', r.required_qty,
          'reserved_qty', COALESCE(res.reserved_qty, 0)
        )
      )
    INTO v_missing_items
    FROM required_items r
    LEFT JOIN reserved_items res ON res.document_item_id = r.document_item_id
    WHERE COALESCE(res.reserved_qty, 0) < r.required_qty;

  ELSIF p_document_type = 'bonus_face_sheet' THEN
    -- Check bonus face sheet items (รองรับหลาย locations)
    WITH required_items AS (
      SELECT 
        bfsi.id as document_item_id,
        bfsi.sku_id,
        bfsi.quantity_piece as required_qty
      FROM bonus_face_sheet_items bfsi
      JOIN bonus_face_sheets bfs ON bfs.id = bfsi.bonus_face_sheet_id
      WHERE bfs.id = ANY(p_document_ids)
    ),
    reserved_items AS (
      SELECT 
        bfsir.bonus_face_sheet_item_id as document_item_id,
        SUM(bfsir.reserved_piece_qty) as reserved_qty
      FROM bonus_face_sheet_item_reservations bfsir
      WHERE bfsir.bonus_face_sheet_item_id IN (SELECT document_item_id FROM required_items)
        AND bfsir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR bfsir.staging_location_id = ANY(p_staging_location_ids))
      GROUP BY bfsir.bonus_face_sheet_item_id
    )
    SELECT 
      json_agg(
        json_build_object(
          'document_item_id', r.document_item_id,
          'sku_id', r.sku_id,
          'required_qty', r.required_qty,
          'reserved_qty', COALESCE(res.reserved_qty, 0)
        )
      )
    INTO v_missing_items
    FROM required_items r
    LEFT JOIN reserved_items res ON res.document_item_id = r.document_item_id
    WHERE COALESCE(res.reserved_qty, 0) < r.required_qty;
  END IF;

  -- Check if there are missing items
  IF v_missing_items IS NULL OR json_array_length(v_missing_items) = 0 THEN
    RETURN json_build_object(
      'valid', true,
      'message', 'All staging reservations are valid',
      'missing_items', '[]'::json
    );
  ELSE
    RETURN json_build_object(
      'valid', false,
      'message', 'Some items are missing staging reservations or have insufficient stock',
      'missing_items', v_missing_items
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Error validating staging reservations: ' || SQLERRM,
      'missing_items', '[]'::json
    );
END;
$$;

COMMENT ON FUNCTION validate_staging_reservations IS 
  'ตรวจสอบ staging reservation ก่อนโหลด - Requirements 2.1-2.8';

-- ============================================================================
-- Function 3: release_staging_reservations_after_load
-- ============================================================================
-- Purpose: ปล่อย staging reservation หลังจากโหลดสำเร็จ
-- Parameters:
--   - p_document_type: 'picklist', 'face_sheet', 'bonus_face_sheet'
--   - p_document_ids: Array ของ document IDs
--   - p_staging_location_ids: Array ของ staging location IDs (optional)
-- Returns: JSON { success: boolean, message: string, reservations_released: integer }

CREATE OR REPLACE FUNCTION release_staging_reservations_after_load(
  p_document_type TEXT,
  p_document_ids INTEGER[],
  p_staging_location_ids VARCHAR[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservations_released INTEGER := 0;
  v_reservation RECORD;
BEGIN
  -- Validate document type
  IF p_document_type NOT IN ('picklist', 'face_sheet', 'bonus_face_sheet') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid document_type: ' || p_document_type,
      'reservations_released', 0
    );
  END IF;

  -- Release reservations based on document type
  IF p_document_type = 'picklist' THEN
    -- Update picklist reservations
    FOR v_reservation IN
      SELECT 
        pir.reservation_id,
        pir.balance_id,
        pir.reserved_piece_qty,
        pir.reserved_pack_qty
      FROM picklist_item_reservations pir
      JOIN picklist_items pi ON pi.id = pir.picklist_item_id
      JOIN picklists p ON p.id = pi.picklist_id
      WHERE p.id = ANY(p_document_ids)
        AND pir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR pir.staging_location_id = ANY(p_staging_location_ids))
      FOR UPDATE
    LOOP
      -- Update reservation status
      UPDATE picklist_item_reservations
      SET 
        status = 'loaded',
        loaded_at = NOW(),
        updated_at = NOW()
      WHERE reservation_id = v_reservation.reservation_id;

      -- Update inventory balance
      UPDATE inventory_balances
      SET 
        reserved_piece_qty = reserved_piece_qty - v_reservation.reserved_piece_qty,
        reserved_pack_qty = reserved_pack_qty - v_reservation.reserved_pack_qty,
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;

      v_reservations_released := v_reservations_released + 1;
    END LOOP;

  ELSIF p_document_type = 'face_sheet' THEN
    -- Update face sheet reservations
    FOR v_reservation IN
      SELECT 
        fsir.reservation_id,
        fsir.balance_id,
        fsir.reserved_piece_qty,
        fsir.reserved_pack_qty
      FROM face_sheet_item_reservations fsir
      JOIN face_sheet_items fsi ON fsi.id = fsir.face_sheet_item_id
      JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
      WHERE fs.id = ANY(p_document_ids)
        AND fsir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR fsir.staging_location_id = ANY(p_staging_location_ids))
      FOR UPDATE
    LOOP
      -- Update reservation status
      UPDATE face_sheet_item_reservations
      SET 
        status = 'loaded',
        loaded_at = NOW(),
        updated_at = NOW()
      WHERE reservation_id = v_reservation.reservation_id;

      -- Update inventory balance
      UPDATE inventory_balances
      SET 
        reserved_piece_qty = reserved_piece_qty - v_reservation.reserved_piece_qty,
        reserved_pack_qty = reserved_pack_qty - v_reservation.reserved_pack_qty,
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;

      v_reservations_released := v_reservations_released + 1;
    END LOOP;

  ELSIF p_document_type = 'bonus_face_sheet' THEN
    -- Update bonus face sheet reservations
    FOR v_reservation IN
      SELECT 
        bfsir.reservation_id,
        bfsir.balance_id,
        bfsir.reserved_piece_qty,
        bfsir.reserved_pack_qty
      FROM bonus_face_sheet_item_reservations bfsir
      JOIN bonus_face_sheet_items bfsi ON bfsi.id = bfsir.bonus_face_sheet_item_id
      JOIN bonus_face_sheets bfs ON bfs.id = bfsi.bonus_face_sheet_id
      WHERE bfs.id = ANY(p_document_ids)
        AND bfsir.status = 'picked'
        AND (p_staging_location_ids IS NULL OR bfsir.staging_location_id = ANY(p_staging_location_ids))
      FOR UPDATE
    LOOP
      -- Update reservation status
      UPDATE bonus_face_sheet_item_reservations
      SET 
        status = 'loaded',
        loaded_at = NOW(),
        updated_at = NOW()
      WHERE reservation_id = v_reservation.reservation_id;

      -- Update inventory balance
      UPDATE inventory_balances
      SET 
        reserved_piece_qty = reserved_piece_qty - v_reservation.reserved_piece_qty,
        reserved_pack_qty = reserved_pack_qty - v_reservation.reserved_pack_qty,
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;

      v_reservations_released := v_reservations_released + 1;
    END LOOP;
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Released ' || v_reservations_released || ' staging reservations',
    'reservations_released', v_reservations_released
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error releasing staging reservations: ' || SQLERRM,
      'reservations_released', 0
    );
END;
$$;

COMMENT ON FUNCTION release_staging_reservations_after_load IS 
  'ปล่อย staging reservation หลังจากโหลดสำเร็จ - Requirements 3.1-3.4';

-- ============================================================================
-- Log completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 231 completed: Created staging reservation functions';
  RAISE NOTICE '   - create_staging_reservation_after_pick()';
  RAISE NOTICE '   - validate_staging_reservations()';
  RAISE NOTICE '   - release_staging_reservations_after_load()';
END $$;

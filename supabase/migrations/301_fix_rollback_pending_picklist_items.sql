-- ============================================================================
-- Migration: 301_fix_rollback_pending_picklist_items.sql
-- Description: Fix rollback to handle pending picklist items correctly
-- Date: 2026-01-23
-- Issue: Rollback fails when trying to void pending picklist items
--        because state machine doesn't allow pending → voided transition
-- Solution: Delete pending picklist items instead of voiding them
-- ============================================================================

-- ============================================================================
-- STEP 1: Update void_order_picklist_items function
-- ============================================================================

CREATE OR REPLACE FUNCTION void_order_picklist_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $
DECLARE
  v_items_voided INT := 0;
  v_items_deleted INT := 0;
  v_affected_picklist_ids BIGINT[];
BEGIN
  -- Get affected picklist IDs (both pending and non-pending)
  SELECT ARRAY_AGG(DISTINCT picklist_id)
  INTO v_affected_picklist_ids
  FROM picklist_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL;

  -- DELETE pending items (can't be voided due to state machine)
  -- Pending items haven't been picked yet, so safe to delete
  DELETE FROM picklist_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL
    AND status = 'pending';
  
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- VOID non-pending items (picked, completed, etc.)
  UPDATE picklist_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_id = p_order_id
    AND voided_at IS NULL
    AND status != 'pending';  -- Only void non-pending items
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RAISE NOTICE 'Rollback picklist items: % deleted (pending), % voided (non-pending)', 
    v_items_deleted, v_items_voided;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'items_deleted', v_items_deleted,
    'items_total', v_items_voided + v_items_deleted,
    'affected_picklist_ids', COALESCE(v_affected_picklist_ids, ARRAY[]::BIGINT[])
  );
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION void_order_picklist_items IS 
  'Void/delete picklist items for order rollback. Deletes pending items, voids others.';

-- ============================================================================
-- STEP 2: Update void_order_face_sheet_items function (same logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION void_order_face_sheet_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $
DECLARE
  v_items_voided INT := 0;
  v_items_deleted INT := 0;
  v_affected_face_sheet_ids BIGINT[];
BEGIN
  -- Get affected face sheet IDs
  SELECT ARRAY_AGG(DISTINCT face_sheet_id)
  INTO v_affected_face_sheet_ids
  FROM face_sheet_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL;

  -- DELETE pending items
  DELETE FROM face_sheet_items
  WHERE order_id = p_order_id
    AND voided_at IS NULL
    AND status = 'pending';
  
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- VOID non-pending items
  UPDATE face_sheet_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_id = p_order_id
    AND voided_at IS NULL
    AND status != 'pending';
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RAISE NOTICE 'Rollback face sheet items: % deleted (pending), % voided (non-pending)', 
    v_items_deleted, v_items_voided;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'items_deleted', v_items_deleted,
    'items_total', v_items_voided + v_items_deleted,
    'affected_face_sheet_ids', COALESCE(v_affected_face_sheet_ids, ARRAY[]::BIGINT[])
  );
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION void_order_face_sheet_items IS 
  'Void/delete face sheet items for order rollback. Deletes pending items, voids others.';

-- ============================================================================
-- STEP 3: Update void_order_bonus_face_sheet_items function (same logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION void_order_bonus_face_sheet_items(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_reason TEXT
) RETURNS JSONB AS $
DECLARE
  v_items_voided INT := 0;
  v_items_deleted INT := 0;
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
      'items_deleted', 0,
      'items_total', 0,
      'affected_bonus_face_sheet_ids', ARRAY[]::BIGINT[]
    );
  END IF;

  -- Get affected bonus face sheet IDs
  SELECT ARRAY_AGG(DISTINCT face_sheet_id)
  INTO v_affected_bonus_face_sheet_ids
  FROM bonus_face_sheet_items
  WHERE order_item_id = ANY(v_order_item_ids)
    AND voided_at IS NULL;

  -- DELETE pending items
  DELETE FROM bonus_face_sheet_items
  WHERE order_item_id = ANY(v_order_item_ids)
    AND voided_at IS NULL
    AND status = 'pending';
  
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- VOID non-pending items
  UPDATE bonus_face_sheet_items
  SET 
    voided_at = NOW(),
    voided_by = p_user_id,
    void_reason = p_reason,
    status = 'voided'
  WHERE order_item_id = ANY(v_order_item_ids)
    AND voided_at IS NULL
    AND status != 'pending';
  
  GET DIAGNOSTICS v_items_voided = ROW_COUNT;

  RAISE NOTICE 'Rollback bonus face sheet items: % deleted (pending), % voided (non-pending)', 
    v_items_deleted, v_items_voided;

  RETURN jsonb_build_object(
    'items_voided', v_items_voided,
    'items_deleted', v_items_deleted,
    'items_total', v_items_voided + v_items_deleted,
    'affected_bonus_face_sheet_ids', COALESCE(v_affected_bonus_face_sheet_ids, ARRAY[]::BIGINT[])
  );
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION void_order_bonus_face_sheet_items IS 
  'Void/delete bonus face sheet items for order rollback. Deletes pending items, voids others.';

-- ============================================================================
-- STEP 4: Update void_empty_parent_documents to handle empty picklists
-- ============================================================================

CREATE OR REPLACE FUNCTION void_empty_parent_documents()
RETURNS JSONB AS $
DECLARE
  v_picklists_voided INT := 0;
  v_picklists_deleted INT := 0;
  v_face_sheets_voided INT := 0;
  v_bonus_face_sheets_voided INT := 0;
  v_loadlists_voided INT := 0;
BEGIN
  -- DELETE empty picklists that are still pending (can't be voided)
  DELETE FROM picklists
  WHERE status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM picklist_items pi
      WHERE pi.picklist_id = picklists.id
    );
  GET DIAGNOSTICS v_picklists_deleted = ROW_COUNT;

  -- VOID empty picklists that are not pending
  UPDATE picklists
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled', 'pending')
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

  RAISE NOTICE 'Empty documents: % picklists deleted, % picklists voided, % face sheets voided, % bonus face sheets voided, % loadlists voided',
    v_picklists_deleted, v_picklists_voided, v_face_sheets_voided, v_bonus_face_sheets_voided, v_loadlists_voided;

  RETURN jsonb_build_object(
    'picklists_deleted', v_picklists_deleted,
    'picklists_voided', v_picklists_voided,
    'face_sheets_voided', v_face_sheets_voided,
    'bonus_face_sheets_voided', v_bonus_face_sheets_voided,
    'loadlists_voided', v_loadlists_voided
  );
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION void_empty_parent_documents IS 
  'Void or delete empty parent documents after rollback. Deletes pending picklists, voids others.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 301: Rollback Pending Items Fix';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Updated void_order_picklist_items';
    RAISE NOTICE '✅ Updated void_order_face_sheet_items';
    RAISE NOTICE '✅ Updated void_order_bonus_face_sheet_items';
    RAISE NOTICE '✅ Updated void_empty_parent_documents';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '- Pending items are now DELETED (not voided)';
    RAISE NOTICE '- Non-pending items are VOIDED as before';
    RAISE NOTICE '- Empty pending picklists are DELETED';
    RAISE NOTICE '- This fixes the state machine transition error';
    RAISE NOTICE '========================================';
END $;

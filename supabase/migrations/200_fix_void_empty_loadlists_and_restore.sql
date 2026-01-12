-- Migration: Fix void_empty_parent_documents function and restore wrongly voided loadlists
-- Date: 2026-01-12
-- Problem: void_empty_parent_documents() only checked loadlist_items but not:
--   - wms_loadlist_picklists
--   - loadlist_face_sheets  
--   - wms_loadlist_bonus_face_sheets
-- This caused 66 loadlists to be wrongly voided on 2026-01-12 01:32:29

-- ============================================
-- STEP 1: Restore wrongly voided loadlists
-- ============================================

-- Disable trigger temporarily to allow status change
ALTER TABLE loadlists DISABLE TRIGGER trigger_validate_loadlist_status;
ALTER TABLE loadlists DISABLE TRIGGER trg_validate_loadlist_status;

-- Restore loadlists that were voided at 2026-01-12 01:32:29 and have linked documents
-- Use the audit log to find the original status
UPDATE loadlists l
SET 
  status = CASE 
    WHEN psal.old_status = 'loaded' THEN 'loaded'::loadlist_status_enum
    WHEN psal.old_status = 'pending' THEN 'pending'::loadlist_status_enum
    ELSE 'pending'::loadlist_status_enum
  END,
  updated_at = NOW()
FROM process_state_audit_log psal
WHERE psal.entity_type = 'loadlist'
  AND psal.entity_id = l.id
  AND psal.new_status = 'voided'
  AND psal.created_at = '2026-01-12 01:32:29.875243'
  AND l.status = 'voided'
  AND (
    -- Has linked picklists
    EXISTS (SELECT 1 FROM wms_loadlist_picklists wlp WHERE wlp.loadlist_id = l.id)
    OR
    -- Has linked face sheets
    EXISTS (SELECT 1 FROM loadlist_face_sheets lfs WHERE lfs.loadlist_id = l.id)
    OR
    -- Has linked bonus face sheets
    EXISTS (SELECT 1 FROM wms_loadlist_bonus_face_sheets wlbfs WHERE wlbfs.loadlist_id = l.id)
  );

-- Re-enable triggers
ALTER TABLE loadlists ENABLE TRIGGER trigger_validate_loadlist_status;
ALTER TABLE loadlists ENABLE TRIGGER trg_validate_loadlist_status;

-- Log the restoration
INSERT INTO process_state_audit_log (entity_type, entity_id, entity_code, old_status, new_status, transition_reason, triggered_by)
SELECT 
  'loadlist',
  l.id,
  l.loadlist_code,
  'voided',
  l.status::text,
  'Restored from wrongly voided - migration fix_void_empty_loadlists_and_restore',
  'migration'
FROM loadlists l
WHERE l.status != 'voided'
  AND EXISTS (
    SELECT 1 FROM process_state_audit_log psal
    WHERE psal.entity_type = 'loadlist'
      AND psal.entity_id = l.id
      AND psal.new_status = 'voided'
      AND psal.created_at = '2026-01-12 01:32:29.875243'
  );

-- ============================================
-- STEP 2: Fix void_empty_parent_documents function
-- ============================================

CREATE OR REPLACE FUNCTION public.void_empty_parent_documents()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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

  -- ✅ FIX: Void empty loadlists - check ALL linked tables
  UPDATE loadlists
  SET status = 'voided'
  WHERE status NOT IN ('voided', 'cancelled')
    -- No loadlist_items
    AND NOT EXISTS (
      SELECT 1 FROM loadlist_items li
      WHERE li.loadlist_id = loadlists.id
    )
    -- No linked picklists
    AND NOT EXISTS (
      SELECT 1 FROM wms_loadlist_picklists wlp
      WHERE wlp.loadlist_id = loadlists.id
    )
    -- No linked face sheets
    AND NOT EXISTS (
      SELECT 1 FROM loadlist_face_sheets lfs
      WHERE lfs.loadlist_id = loadlists.id
    )
    -- No linked bonus face sheets
    AND NOT EXISTS (
      SELECT 1 FROM wms_loadlist_bonus_face_sheets wlbfs
      WHERE wlbfs.loadlist_id = loadlists.id
    );
  GET DIAGNOSTICS v_loadlists_voided = ROW_COUNT;

  RETURN jsonb_build_object(
    'picklists_voided', v_picklists_voided,
    'face_sheets_voided', v_face_sheets_voided,
    'bonus_face_sheets_voided', v_bonus_face_sheets_voided,
    'loadlists_voided', v_loadlists_voided
  );
END;
$function$;

-- ============================================
-- STEP 3: Also fix find_empty_loadlists function
-- ============================================

CREATE OR REPLACE FUNCTION find_empty_loadlists()
RETURNS TABLE(id BIGINT, loadlist_code VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT ll.id, ll.loadlist_code
    FROM loadlists ll
    WHERE ll.status NOT IN ('voided', 'cancelled')
      -- No loadlist_items
      AND NOT EXISTS (SELECT 1 FROM loadlist_items li WHERE li.loadlist_id = ll.id)
      -- No linked picklists
      AND NOT EXISTS (SELECT 1 FROM wms_loadlist_picklists wlp WHERE wlp.loadlist_id = ll.id)
      -- No linked face sheets
      AND NOT EXISTS (SELECT 1 FROM loadlist_face_sheets lfs WHERE lfs.loadlist_id = ll.id)
      -- No linked bonus face sheets
      AND NOT EXISTS (SELECT 1 FROM wms_loadlist_bonus_face_sheets wlbfs WHERE wlbfs.loadlist_id = ll.id);
END;
$$;

COMMENT ON FUNCTION void_empty_parent_documents() IS 
'Voids empty parent documents (picklists, face sheets, bonus face sheets, loadlists). 
For loadlists, checks loadlist_items, wms_loadlist_picklists, loadlist_face_sheets, and wms_loadlist_bonus_face_sheets.';

COMMENT ON FUNCTION find_empty_loadlists() IS 
'Finds loadlists that have no items and no linked documents (picklists, face sheets, bonus face sheets).';

-- Migration: Fix face sheets with missing stock reservations
-- Purpose: Ensure all face sheet items have proper stock reservations
-- Date: 2026-01-15

-- Function to fix missing reservations for existing face sheets
CREATE OR REPLACE FUNCTION fix_face_sheet_missing_reservations()
RETURNS TABLE(
  face_sheet_id BIGINT,
  face_sheet_no VARCHAR,
  items_fixed INTEGER,
  reservations_created INTEGER,
  message TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_face_sheet RECORD;
  v_items_without_reservations INTEGER;
  v_items_fixed INTEGER := 0;
  v_reservations_created INTEGER := 0;
  v_reserve_result RECORD;
BEGIN
  -- Find face sheets with items that have status 'reserved' but no actual reservations
  FOR v_face_sheet IN
    SELECT 
      fs.id,
      fs.face_sheet_no,
      COUNT(fsi.id) as items_without_reservations
    FROM face_sheets fs
    JOIN face_sheet_items fsi ON fsi.face_sheet_id = fs.id
    LEFT JOIN face_sheet_item_reservations fsir ON fsir.face_sheet_item_id = fsi.id AND fsir.status = 'reserved'
    WHERE fsi.status = 'reserved'
    AND fsir.face_sheet_item_id IS NULL  -- No reservations exist
    GROUP BY fs.id, fs.face_sheet_no
    HAVING COUNT(fsi.id) > 0
    ORDER BY fs.id
  LOOP
    -- Reset items to pending status so they can be reserved
    UPDATE face_sheet_items 
    SET status = 'pending'
    WHERE face_sheet_id = v_face_sheet.id 
    AND status = 'reserved'
    AND id NOT IN (
      SELECT DISTINCT face_sheet_item_id 
      FROM face_sheet_item_reservations 
      WHERE status = 'reserved'
    );

    -- Call reserve function
    SELECT * INTO v_reserve_result
    FROM reserve_stock_for_face_sheet_items(
      p_face_sheet_id := v_face_sheet.id,
      p_warehouse_id := 'WH001',
      p_reserved_by := 'System-Migration'
    );

    IF v_reserve_result.success THEN
      v_items_fixed := v_items_fixed + v_reserve_result.items_reserved;
      
      -- Count actual reservations created
      SELECT COUNT(*) INTO v_reservations_created
      FROM face_sheet_item_reservations fsir
      JOIN face_sheet_items fsi ON fsi.id = fsir.face_sheet_item_id
      WHERE fsi.face_sheet_id = v_face_sheet.id
      AND fsir.status = 'reserved';

      RETURN QUERY SELECT 
        v_face_sheet.id,
        v_face_sheet.face_sheet_no,
        v_reserve_result.items_reserved,
        v_reservations_created,
        format('Fixed %s items, created %s reservations', v_reserve_result.items_reserved, v_reservations_created);
    ELSE
      RETURN QUERY SELECT 
        v_face_sheet.id,
        v_face_sheet.face_sheet_no,
        0,
        0,
        format('Failed to reserve: %s', v_reserve_result.message);
    END IF;
  END LOOP;

  IF v_items_fixed = 0 THEN
    RETURN QUERY SELECT 
      NULL::BIGINT,
      'No issues found'::VARCHAR,
      0,
      0,
      'All face sheets already have proper reservations'::TEXT;
  END IF;
END;
$$;

-- Run the fix function
SELECT * FROM fix_face_sheet_missing_reservations();

-- Add comment
COMMENT ON FUNCTION fix_face_sheet_missing_reservations() IS 'Fixes face sheets that have reserved items but missing stock reservations';

-- Migration 239: Fix Dispatch Reservations - Set staging_location_id = 'Dispatch'
-- 
-- Problem: Picklist item reservations for items at Dispatch have staging_location_id = NULL
--          This causes the dispatch inventory API to not show them (it filters by staging_location_id = 'Dispatch')
--
-- Solution: Update reservations for the 3 pending picklists to set staging_location_id = 'Dispatch'
--           Keep status = 'picked' (which means picked and waiting at staging location)

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '🔧 Migration 239: Fix Dispatch Reservations - Set staging_location_id';
  RAISE NOTICE '================================================================';
  
  -- Update picklist_item_reservations for the 3 pending picklists
  -- Set staging_location_id = 'Dispatch' (keep status = 'picked')
  WITH pending_picklists AS (
    SELECT id 
    FROM picklists 
    WHERE picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  ),
  pending_items AS (
    SELECT pi.id
    FROM picklist_items pi
    WHERE pi.picklist_id IN (SELECT id FROM pending_picklists)
      AND pi.voided_at IS NULL
  )
  UPDATE picklist_item_reservations r
  SET 
    staging_location_id = 'Dispatch',
    updated_at = NOW()
  FROM pending_items pi
  WHERE r.picklist_item_id = pi.id
    AND r.status = 'picked'
    AND r.staging_location_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Updated % reservations to staging_location_id = Dispatch', v_updated_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Verification:';
  
  -- Count reservations by picklist
  FOR rec IN (
    SELECT 
      p.picklist_code,
      COUNT(r.reservation_id) as reservation_count,
      SUM(r.reserved_piece_qty) as total_reserved
    FROM picklists p
    JOIN picklist_items pi ON pi.picklist_id = p.id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    WHERE p.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
      AND r.staging_location_id = 'Dispatch'
      AND r.status = 'picked'
      AND pi.voided_at IS NULL
    GROUP BY p.picklist_code
    ORDER BY p.picklist_code
  ) LOOP
    RAISE NOTICE '  %: % items, % pieces', rec.picklist_code, rec.reservation_count, rec.total_reserved;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ Migration 239 completed successfully';
  
END $$;

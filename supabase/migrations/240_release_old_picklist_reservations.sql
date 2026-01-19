-- Migration 240: Release Old Picklist Reservations
-- 
-- Problem: Old picklists (PL-20260116-003/005/006) have reservations with status='picked'
--          but staging_location_id=NULL. These picklists are completed but never assigned
--          to a loadlist, causing them to show in the Dispatch tab due to SKU overlap.
--
-- Solution: Release their reservations (change status from 'picked' to 'released')
--           This will free up the inventory and prevent them from showing in Dispatch tab.

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '🔧 Migration 240: Release Old Picklist Reservations';
  RAISE NOTICE '================================================================';
  
  -- Show current state before update
  RAISE NOTICE '';
  RAISE NOTICE '📊 Before Update:';
  FOR rec IN (
    SELECT 
      p.picklist_code,
      COUNT(r.reservation_id) as reservation_count,
      r.status,
      r.staging_location_id,
      SUM(r.reserved_piece_qty) as total_reserved
    FROM picklists p
    JOIN picklist_items pi ON pi.picklist_id = p.id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    WHERE p.picklist_code IN ('PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006')
      AND pi.voided_at IS NULL
    GROUP BY p.picklist_code, r.status, r.staging_location_id
    ORDER BY p.picklist_code
  ) LOOP
    RAISE NOTICE '  %: % reservations (status=%, staging_location_id=%), % pieces', 
      rec.picklist_code, rec.reservation_count, rec.status, 
      COALESCE(rec.staging_location_id, 'NULL'), rec.total_reserved;
  END LOOP;
  
  -- Release reservations for old picklists
  -- Change status from 'picked' to 'released'
  -- Keep staging_location_id as NULL (since they were never properly staged)
  WITH old_picklists AS (
    SELECT id 
    FROM picklists 
    WHERE picklist_code IN ('PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006')
  ),
  old_items AS (
    SELECT pi.id
    FROM picklist_items pi
    WHERE pi.picklist_id IN (SELECT id FROM old_picklists)
      AND pi.voided_at IS NULL
  )
  UPDATE picklist_item_reservations r
  SET 
    status = 'released',
    updated_at = NOW()
  FROM old_items oi
  WHERE r.picklist_item_id = oi.id
    AND r.status = 'picked'
    AND r.staging_location_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Released % reservations (changed status from picked to released)', v_updated_count;
  
  -- Show state after update
  RAISE NOTICE '';
  RAISE NOTICE '📊 After Update:';
  FOR rec IN (
    SELECT 
      p.picklist_code,
      COUNT(r.reservation_id) as reservation_count,
      r.status,
      r.staging_location_id,
      SUM(r.reserved_piece_qty) as total_reserved
    FROM picklists p
    JOIN picklist_items pi ON pi.picklist_id = p.id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    WHERE p.picklist_code IN ('PL-20260116-003', 'PL-20260116-005', 'PL-20260116-006')
      AND pi.voided_at IS NULL
    GROUP BY p.picklist_code, r.status, r.staging_location_id
    ORDER BY p.picklist_code, r.status
  ) LOOP
    RAISE NOTICE '  %: % reservations (status=%, staging_location_id=%), % pieces', 
      rec.picklist_code, rec.reservation_count, rec.status, 
      COALESCE(rec.staging_location_id, 'NULL'), rec.total_reserved;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ Migration 240 completed successfully';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Result: Old picklists will no longer show in Dispatch tab';
  RAISE NOTICE '   Their reservations are now released and inventory is freed up';
  
END $$;

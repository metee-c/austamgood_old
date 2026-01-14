-- Migration: Remove BFS ledger entries from Dispatch (incorrect location)
-- Date: 2026-01-14
-- Issue: Bonus Face Sheet items should come from PQTD/MRTD, not Dispatch
-- Fix: Delete incorrect ledger entries where BFS items were moved from Dispatch

BEGIN;

-- =====================================================
-- DELETE INCORRECT LEDGER ENTRIES
-- =====================================================
-- BFS items (TT-*, PRE-*) should NOT come from Dispatch
-- They should come from PQTD/MRTD staging areas

DELETE FROM wms_inventory_ledger
WHERE reference_doc_type = 'loadlist'
  AND direction = 'out'
  AND location_id = (SELECT location_id FROM master_location WHERE location_code = 'Dispatch')
  AND (sku_id LIKE 'TT-%' OR sku_id LIKE 'PRE-%')
  AND reference_no IN (
    'LD-20260107-0013',  -- BFS-20260107-007
    'LD-20260107-0011',  -- BFS-20260107-001
    'LD-20260106-0011',  -- BFS-20260106-005
    'LD-20260105-0001'   -- BFS-20260105-001
  );

-- Also delete corresponding IN entries to Delivery-In-Progress
DELETE FROM wms_inventory_ledger
WHERE reference_doc_type = 'loadlist'
  AND direction = 'in'
  AND location_id = (SELECT location_id FROM master_location WHERE location_code = 'Delivery-In-Progress')
  AND (sku_id LIKE 'TT-%' OR sku_id LIKE 'PRE-%')
  AND reference_no IN (
    'LD-20260107-0013',
    'LD-20260107-0011',
    'LD-20260106-0011',
    'LD-20260105-0001'
  );

-- =====================================================
-- LOG SUMMARY
-- =====================================================
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Migration 213: Removed % incorrect BFS ledger entries from Dispatch', v_deleted_count;
  RAISE NOTICE '   - Affected loadlists: LD-20260107-0013, LD-20260107-0011, LD-20260106-0011, LD-20260105-0001';
  RAISE NOTICE '   - BFS items should come from PQTD/MRTD, not Dispatch';
END $$;

COMMIT;

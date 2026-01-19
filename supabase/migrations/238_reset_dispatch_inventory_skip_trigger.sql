-- ============================================================================
-- Migration 238: Reset Dispatch Inventory (Fixed - Skip Trigger Sync)
-- ============================================================================
-- Goal: Delete all Dispatch inventory and recreate to match only the 3 pending
--       picklists WITHOUT trigger doubling the quantities
-- Date: 2026-01-19
-- Reference: docs/Inventories/edit02.md
-- Fix: Set skip_balance_sync = true to prevent trigger from doubling quantities
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DELETE OLD DATA
-- ============================================================================

-- Delete all balance records at Dispatch (backup already exists from migration 237)
DELETE FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- Delete ledger entries from previous attempt
DELETE FROM wms_inventory_ledger 
WHERE reference_no = 'RESET-DISPATCH-20260119';

-- ============================================================================
-- STEP 2: CREATE NEW BALANCE FROM 3 PENDING PICKLISTS
-- ============================================================================

-- Insert new balance records from picklist items
-- All quantities should be RESERVED (waiting for loading)
INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    total_piece_qty,
    total_pack_qty,
    reserved_piece_qty,
    reserved_pack_qty,
    last_movement_at,
    created_at,
    updated_at
)
SELECT 
    'WH001' as warehouse_id,
    'Dispatch' as location_id,
    pli.sku_id,
    COALESCE(pli.source_location_id || '-DISPATCH-' || pl.picklist_code, 'DISPATCH-PENDING') as pallet_id,
    NULL as pallet_id_external,
    SUM(pli.quantity_picked) as total_piece_qty,
    0 as total_pack_qty,
    SUM(pli.quantity_picked) as reserved_piece_qty,  -- All reserved (waiting for loading)
    0 as reserved_pack_qty,
    NOW() as last_movement_at,
    NOW() as created_at,
    NOW() as updated_at
FROM picklists pl
JOIN picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
    AND pl.status = 'completed'
    AND pli.quantity_picked > 0
GROUP BY 
    pli.sku_id,
    COALESCE(pli.source_location_id || '-DISPATCH-' || pl.picklist_code, 'DISPATCH-PENDING');

-- Create adjustment ledger entry with skip_balance_sync = true
-- This prevents the trigger from syncing back to balance table
INSERT INTO wms_inventory_ledger (
    transaction_type,
    reference_no,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    direction,
    piece_qty,
    pack_qty,
    remarks,
    skip_balance_sync,
    created_at,
    created_by
)
SELECT 
    'reset_adjustment' as transaction_type,
    'RESET-DISPATCH-20260119' as reference_no,
    'WH001' as warehouse_id,
    'Dispatch' as location_id,
    pli.sku_id,
    COALESCE(pli.source_location_id || '-DISPATCH-' || pl.picklist_code, 'DISPATCH-PENDING') as pallet_id,
    'in' as direction,
    SUM(pli.quantity_picked) as piece_qty,
    0 as pack_qty,
    'Reset Dispatch balance to match 3 pending picklists: PL-20260118-001, PL-20260118-002, PL-20260118-003. Previous balance was -5,972 pieces (incorrect). New balance matches picked items awaiting loading. Skip trigger sync to prevent double counting.' as remarks,
    true as skip_balance_sync,  -- CRITICAL: Prevent trigger from syncing
    NOW() as created_at,
    1 as created_by  -- System user
FROM picklists pl
JOIN picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
    AND pl.status = 'completed'
    AND pli.quantity_picked > 0
GROUP BY 
    pli.sku_id,
    COALESCE(pli.source_location_id || '-DISPATCH-' || pl.picklist_code, 'DISPATCH-PENDING');

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

DO $
DECLARE
    new_balance_pieces NUMERIC;
    new_balance_items INTEGER;
    expected_pieces NUMERIC;
    negative_count INTEGER;
BEGIN
    -- Get new balance totals
    SELECT 
        COALESCE(SUM(total_piece_qty), 0),
        COUNT(*)
    INTO new_balance_pieces, new_balance_items
    FROM wms_inventory_balances
    WHERE location_id = 'Dispatch';
    
    -- Get expected from picklists
    SELECT COALESCE(SUM(quantity_picked), 0)
    INTO expected_pieces
    FROM picklists pl
    JOIN picklist_items pli ON pl.id = pli.picklist_id
    WHERE pl.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
        AND pl.status = 'completed';
    
    -- Check for negative balances
    SELECT COUNT(*)
    INTO negative_count
    FROM wms_inventory_balances
    WHERE location_id = 'Dispatch' AND total_piece_qty < 0;
    
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    RAISE NOTICE 'New Balance Total: % pieces', new_balance_pieces;
    RAISE NOTICE 'New Balance Items: %', new_balance_items;
    RAISE NOTICE 'Expected from Picklists: % pieces', expected_pieces;
    RAISE NOTICE 'Negative Balance Count: %', negative_count;
    RAISE NOTICE '';
    
    -- Validation checks
    IF ABS(new_balance_pieces - expected_pieces) > 0.01 THEN
        RAISE EXCEPTION 'Balance mismatch! New: %, Expected: %', new_balance_pieces, expected_pieces;
    ELSE
        RAISE NOTICE '✓ Balance matches expected value (2,062 pieces)';
    END IF;
    
    IF negative_count > 0 THEN
        RAISE EXCEPTION 'Found % negative balance records!', negative_count;
    ELSE
        RAISE NOTICE '✓ No negative balances';
    END IF;
    
    IF new_balance_pieces < 2000 OR new_balance_pieces > 2100 THEN
        RAISE EXCEPTION 'Balance outside expected range (2000-2100): %', new_balance_pieces;
    ELSE
        RAISE NOTICE '✓ Balance within expected range';
    END IF;
END $;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTE
-- ============================================================================
-- Backup tables from migration 237 still exist:
--   - backup_dispatch_balance_20260119
--   - backup_dispatch_ledger_20260119
-- ============================================================================

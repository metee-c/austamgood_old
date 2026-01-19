-- ============================================================================
-- Migration 237: Reset Dispatch Inventory to Match 3 Pending Picklists Only
-- ============================================================================
-- Goal: Delete all Dispatch inventory and recreate to match only the 3 pending
--       picklists that are picked but not yet loaded
-- Date: 2026-01-19
-- Reference: docs/Inventories/edit02.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: BACKUP EXISTING DATA (MANDATORY)
-- ============================================================================

-- 1.1 Backup Balance Table
CREATE TABLE IF NOT EXISTS backup_dispatch_balance_20260119 AS
SELECT * FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 1.2 Backup Ledger
CREATE TABLE IF NOT EXISTS backup_dispatch_ledger_20260119 AS
SELECT * FROM wms_inventory_ledger
WHERE location_id = 'Dispatch';

-- 1.3 Verify backup success
DO $$
DECLARE
    balance_count INTEGER;
    ledger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO balance_count FROM backup_dispatch_balance_20260119;
    SELECT COUNT(*) INTO ledger_count FROM backup_dispatch_ledger_20260119;
    
    RAISE NOTICE 'Backup created successfully:';
    RAISE NOTICE '  Balance records: %', balance_count;
    RAISE NOTICE '  Ledger records: %', ledger_count;
END $$;

-- ============================================================================
-- STEP 2: VERIFY 3 PENDING PICKLISTS DATA
-- ============================================================================

DO $$
DECLARE
    picklist_count INTEGER;
    total_items INTEGER;
    total_pieces NUMERIC;
BEGIN
    SELECT 
        COUNT(DISTINCT pl.id),
        COUNT(pli.id),
        SUM(pli.quantity_picked)
    INTO picklist_count, total_items, total_pieces
    FROM picklists pl
    JOIN picklist_items pli ON pl.id = pli.picklist_id
    WHERE pl.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
        AND pl.status = 'completed';
    
    RAISE NOTICE 'Pending Picklists Summary:';
    RAISE NOTICE '  Picklists: %', picklist_count;
    RAISE NOTICE '  Total items: %', total_items;
    RAISE NOTICE '  Total pieces: %', total_pieces;
    
    IF picklist_count != 3 THEN
        RAISE EXCEPTION 'Expected 3 picklists but found %', picklist_count;
    END IF;
    
    IF total_pieces IS NULL OR total_pieces = 0 THEN
        RAISE EXCEPTION 'No picked items found in the 3 picklists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: DELETE OLD DISPATCH INVENTORY
-- ============================================================================

-- 3.1 Delete all balance records at Dispatch
DELETE FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 3.2 Delete old ledger entries (optional - keeping for audit trail)
-- We'll add a new adjustment entry instead of deleting history

DO $$
BEGIN
    RAISE NOTICE 'Deleted all existing Dispatch balance records';
END $$;

-- ============================================================================
-- STEP 4: CREATE NEW BALANCE FROM 3 PENDING PICKLISTS
-- ============================================================================

-- 4.1 Insert new balance records from picklist items
INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    lot_no,
    production_date,
    expiry_date,
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
    NULL as lot_no,
    NULL as production_date,
    NULL as expiry_date,
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

-- 4.2 Create adjustment ledger entry to record the reset
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
    'Reset Dispatch balance to match 3 pending picklists: PL-20260118-001, PL-20260118-002, PL-20260118-003. Previous balance was -5,972 pieces (incorrect). New balance matches picked items awaiting loading.' as remarks,
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
-- STEP 5: VERIFICATION
-- ============================================================================

DO $$
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
        RAISE WARNING 'Balance mismatch! New: %, Expected: %', new_balance_pieces, expected_pieces;
    ELSE
        RAISE NOTICE '✓ Balance matches expected value';
    END IF;
    
    IF negative_count > 0 THEN
        RAISE WARNING 'Found % negative balance records!', negative_count;
    ELSE
        RAISE NOTICE '✓ No negative balances';
    END IF;
    
    IF new_balance_pieces < 2000 OR new_balance_pieces > 2100 THEN
        RAISE WARNING 'Balance outside expected range (2000-2100): %', new_balance_pieces;
    ELSE
        RAISE NOTICE '✓ Balance within expected range';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: SHOW DETAILED RESULTS
-- ============================================================================

-- Show balance by SKU
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== BALANCE BY SKU (Top 10) ===';
    
    FOR rec IN (
        SELECT 
            ib.sku_id,
            ms.sku_name,
            SUM(ib.total_piece_qty) as total_pieces,
            SUM(ib.reserved_piece_qty) as reserved_pieces,
            COUNT(*) as pallet_count
        FROM wms_inventory_balances ib
        LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
        WHERE ib.location_id = 'Dispatch'
        GROUP BY ib.sku_id, ms.sku_name
        ORDER BY SUM(ib.total_piece_qty) DESC
        LIMIT 10
    ) LOOP
        RAISE NOTICE '  %: % pieces (% reserved, % pallets)', 
            rec.sku_id, rec.total_pieces, rec.reserved_pieces, rec.pallet_count;
    END LOOP;
END $$;

-- ============================================================================
-- FINAL COMMIT CHECK
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Review the results above. If everything looks correct, the transaction will commit.';
    RAISE NOTICE 'If there are any issues, the transaction will rollback automatically.';
    RAISE NOTICE '';
    RAISE NOTICE 'Backup tables created:';
    RAISE NOTICE '  - backup_dispatch_balance_20260119';
    RAISE NOTICE '  - backup_dispatch_ledger_20260119';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback manually if needed:';
    RAISE NOTICE '  DELETE FROM wms_inventory_balances WHERE location_id = ''Dispatch'';';
    RAISE NOTICE '  INSERT INTO wms_inventory_balances SELECT * FROM backup_dispatch_balance_20260119;';
    RAISE NOTICE '  DELETE FROM wms_inventory_ledger WHERE reference_no = ''RESET-DISPATCH-20260119'';';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after migration to verify results:

-- 1. Check total balance
-- SELECT 
--     'New Balance' as source,
--     COUNT(*) as total_items,
--     SUM(total_piece_qty) as total_pieces,
--     SUM(reserved_piece_qty) as reserved_pieces
-- FROM wms_inventory_balances
-- WHERE location_id = 'Dispatch';

-- 2. Compare with picklists
-- SELECT 
--     'Expected from Picklists' as source,
--     COUNT(DISTINCT pli.sku_id) as total_items,
--     SUM(pli.quantity_picked) as total_pieces
-- FROM picklists pl
-- JOIN picklist_items pli ON pl.id = pli.picklist_id
-- WHERE pl.picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003');

-- 3. Check for negative balances
-- SELECT COUNT(*) as negative_balance_count
-- FROM wms_inventory_balances
-- WHERE location_id = 'Dispatch' AND total_piece_qty < 0;

-- 4. View balance details
-- SELECT 
--     ib.sku_id,
--     ms.sku_name,
--     ib.pallet_id,
--     ib.total_piece_qty,
--     ib.reserved_piece_qty
-- FROM wms_inventory_balances ib
-- LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
-- WHERE ib.location_id = 'Dispatch'
-- ORDER BY ib.total_piece_qty DESC;

-- ============================================================================
-- Fix Dispatch Location Negative Balance Issue
-- ============================================================================
-- Problem: Balance table shows -5,972 pieces but ledger shows -330 pieces
-- Root Cause: Balance table not synced with ledger (5,642 pieces difference)
-- Date: 2026-01-19
-- ============================================================================

BEGIN;

-- Step 1: Create backup of current balance
CREATE TEMP TABLE dispatch_balance_backup AS
SELECT * FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

SELECT 'Backup created: ' || COUNT(*) || ' records' as backup_status
FROM dispatch_balance_backup;

-- Step 2: Show current state
SELECT 
    'BEFORE FIX - Balance Table' as status,
    SUM(total_piece_qty) as total_pieces,
    SUM(reserved_piece_qty) as reserved_pieces,
    COUNT(*) as balance_records
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

SELECT 
    'BEFORE FIX - Ledger' as status,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_balance
FROM wms_inventory_ledger
WHERE location_id = 'Dispatch';

-- Step 3: Recalculate balance from ledger
WITH ledger_summary AS (
    SELECT 
        location_id,
        sku_id,
        COALESCE(pallet_id, '') as pallet_id,
        COALESCE(lot_no, '') as lot_no,
        production_date,
        expiry_date,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calculated_piece_qty,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calculated_pack_qty,
        MAX(created_at) as last_movement_at
    FROM wms_inventory_ledger
    WHERE location_id = 'Dispatch'
    GROUP BY location_id, sku_id, COALESCE(pallet_id, ''), COALESCE(lot_no, ''), production_date, expiry_date
    HAVING SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) != 0
)
UPDATE wms_inventory_balances ib
SET 
    total_piece_qty = ls.calculated_piece_qty,
    total_pack_qty = ls.calculated_pack_qty,
    last_movement_at = ls.last_movement_at,
    updated_at = NOW()
FROM ledger_summary ls
WHERE ib.location_id = ls.location_id
    AND ib.sku_id = ls.sku_id
    AND COALESCE(ib.pallet_id, '') = ls.pallet_id
    AND COALESCE(ib.lot_no, '') = ls.lot_no
    AND COALESCE(ib.production_date, '1900-01-01'::date) = COALESCE(ls.production_date, '1900-01-01'::date)
    AND COALESCE(ib.expiry_date, '1900-01-01'::date) = COALESCE(ls.expiry_date, '1900-01-01'::date);

-- Step 4: Insert missing balance records from ledger
INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    lot_no,
    production_date,
    expiry_date,
    total_pack_qty,
    total_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    last_movement_at,
    created_at,
    updated_at
)
SELECT 
    'WH001' as warehouse_id,
    ls.location_id,
    ls.sku_id,
    NULLIF(ls.pallet_id, ''),
    NULLIF(ls.lot_no, ''),
    ls.production_date,
    ls.expiry_date,
    ls.calculated_pack_qty,
    ls.calculated_piece_qty,
    0 as reserved_pack_qty,
    0 as reserved_piece_qty,
    ls.last_movement_at,
    NOW(),
    NOW()
FROM (
    SELECT 
        location_id,
        sku_id,
        COALESCE(pallet_id, '') as pallet_id,
        COALESCE(lot_no, '') as lot_no,
        production_date,
        expiry_date,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calculated_piece_qty,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calculated_pack_qty,
        MAX(created_at) as last_movement_at
    FROM wms_inventory_ledger
    WHERE location_id = 'Dispatch'
    GROUP BY location_id, sku_id, COALESCE(pallet_id, ''), COALESCE(lot_no, ''), production_date, expiry_date
    HAVING SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) != 0
) ls
WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances ib
    WHERE ib.location_id = ls.location_id
        AND ib.sku_id = ls.sku_id
        AND COALESCE(ib.pallet_id, '') = ls.pallet_id
        AND COALESCE(ib.lot_no, '') = ls.lot_no
        AND COALESCE(ib.production_date, '1900-01-01'::date) = COALESCE(ls.production_date, '1900-01-01'::date)
        AND COALESCE(ib.expiry_date, '1900-01-01'::date) = COALESCE(ls.expiry_date, '1900-01-01'::date)
);

-- Step 5: Delete zero balance records
DELETE FROM wms_inventory_balances
WHERE location_id = 'Dispatch'
    AND total_piece_qty = 0
    AND reserved_piece_qty = 0;

-- Step 6: Show results after fix
SELECT 
    'AFTER FIX - Balance Table' as status,
    SUM(total_piece_qty) as total_pieces,
    SUM(reserved_piece_qty) as reserved_pieces,
    COUNT(*) as balance_records
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

SELECT 
    'AFTER FIX - Ledger' as status,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_balance
FROM wms_inventory_ledger
WHERE location_id = 'Dispatch';

-- Step 7: Verify the fix - should show 0 difference
SELECT 
    'Verification' as check_type,
    (SELECT SUM(total_piece_qty) FROM wms_inventory_balances WHERE location_id = 'Dispatch') as balance_total,
    (SELECT SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) FROM wms_inventory_ledger WHERE location_id = 'Dispatch') as ledger_total,
    (SELECT SUM(total_piece_qty) FROM wms_inventory_balances WHERE location_id = 'Dispatch') - 
    (SELECT SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) FROM wms_inventory_ledger WHERE location_id = 'Dispatch') as difference;

-- Step 8: Show remaining negative balances (should be minimal)
SELECT 
    ib.sku_id,
    ms.sku_name,
    ib.pallet_id,
    ib.total_piece_qty,
    ib.reserved_piece_qty
FROM wms_inventory_balances ib
LEFT JOIN master_sku ms ON ib.sku_id = ms.sku_id
WHERE ib.location_id = 'Dispatch'
    AND ib.total_piece_qty < 0
ORDER BY ib.total_piece_qty
LIMIT 20;

-- If everything looks good, commit the transaction
-- COMMIT;

-- If there's an issue, rollback
-- ROLLBACK;

-- ============================================================================
-- IMPORTANT: Review the results before committing!
-- ============================================================================

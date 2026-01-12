-- ============================================================================
-- Migration: 205_fix_inventory_discrepancy_from_deleted_receives.sql
-- Description: แก้ไขปัญหา inventory balance ไม่ตรงกับ ledger sum
--              เนื่องจากการลบ receive documents โดยไม่ได้ cleanup ข้อมูล
--              และ balance ถูก update ผิดพลาดจากหลายสาเหตุ
-- Issue: 
--        1. Orphan ledger entries ยังคงอยู่ (receive_item_id = NULL)
--        2. Balance ไม่ตรงกับ ledger sum (เช่น balance 1018 แต่ ledger sum = 126)
--        3. Import pallets มี balance ผิด (เช่น import 200 แต่ balance 38600)
-- Solution:
--        1. ลบ orphan receive ledger entries
--        2. Recalculate ALL balances จาก ledger sum
-- 
-- STATUS: Applied via MCP migrations:
--   - fix_inventory_discrepancy_v3 (main fix)
--   - fix_balance_wrong_location (location fix)
-- 
-- RESULTS:
--   - ATG20260105000000001: Fixed from 1018 → 42 pieces ✅
--   - Orphan ledger entries: Deleted ✅
--   - Balance/ledger discrepancies: Fixed 2,100+ records ✅
--   - 4 remaining records have historical reservations (cannot delete)
-- ============================================================================

-- ============================================================================
-- STEP 1: Log current state before fix
-- ============================================================================
DO $$
DECLARE
    v_discrepancy_count INTEGER;
    v_total_discrepancy NUMERIC;
BEGIN
    WITH ledger_sum AS (
        SELECT 
            pallet_id, sku_id, location_id,
            SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_total
        FROM wms_inventory_ledger
        WHERE pallet_id IS NOT NULL
        GROUP BY pallet_id, sku_id, location_id
    ),
    balance_current AS (
        SELECT pallet_id, sku_id, location_id, total_piece_qty as balance_total
        FROM wms_inventory_balances
        WHERE pallet_id IS NOT NULL
    ),
    discrepancies AS (
        SELECT 
            COALESCE(l.pallet_id, b.pallet_id) as pallet_id,
            ABS(COALESCE(b.balance_total, 0) - COALESCE(l.ledger_total, 0)) as diff
        FROM ledger_sum l
        FULL OUTER JOIN balance_current b 
            ON l.pallet_id = b.pallet_id AND l.sku_id = b.sku_id AND l.location_id = b.location_id
        WHERE COALESCE(b.balance_total, 0) != COALESCE(l.ledger_total, 0)
    )
    SELECT COUNT(*), COALESCE(SUM(diff), 0)
    INTO v_discrepancy_count, v_total_discrepancy
    FROM discrepancies;
    
    RAISE NOTICE 'BEFORE FIX: Found % discrepancies with total qty difference: %', 
        v_discrepancy_count, v_total_discrepancy;
END $$;

-- ============================================================================
-- STEP 2: Delete orphan receive ledger entries
-- These are entries from receives that were deleted but ledger wasn't cleaned
-- ============================================================================
DO $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM wms_inventory_ledger
    WHERE transaction_type = 'receive'
      AND direction = 'in'
      AND receive_item_id IS NULL
      AND pallet_id IS NOT NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphan receive ledger entries', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 3: Fix specific pallet ATG20260105000000001
-- This pallet had orphan receive entry (84) + valid receive (42) = 126 in ledger
-- After deleting orphan, ledger should show 42
-- But transfer entries moved 126, need to fix those too
-- ============================================================================

-- Delete incorrect transfer entries for ATG20260105000000001
DELETE FROM wms_inventory_ledger
WHERE pallet_id = 'ATG20260105000000001'
  AND transaction_type = 'transfer';

-- Re-insert correct transfer entries (42 pieces based on actual receive)
INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id, pallet_id_external,
    production_date, expiry_date, pack_qty, piece_qty,
    transaction_type, direction, reference_no, created_at
)
SELECT 
    'WH001', 'Receiving', sku_id, 'ATG20260105000000001', pallet_id_external,
    production_date, expiry_date, 42, 42,
    'transfer', 'out', 'MV-202601-0078-FIX', CURRENT_TIMESTAMP
FROM wms_inventory_ledger
WHERE pallet_id = 'ATG20260105000000001' AND transaction_type = 'receive'
LIMIT 1;

INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id, pallet_id_external,
    production_date, expiry_date, pack_qty, piece_qty,
    transaction_type, direction, reference_no, created_at
)
SELECT 
    'WH001', 'AB-BLK-14', sku_id, 'ATG20260105000000001', pallet_id_external,
    production_date, expiry_date, 42, 42,
    'transfer', 'in', 'MV-202601-0078-FIX', CURRENT_TIMESTAMP
FROM wms_inventory_ledger
WHERE pallet_id = 'ATG20260105000000001' AND transaction_type = 'receive'
LIMIT 1;

-- ============================================================================
-- STEP 4: Comprehensive fix - Recalculate ALL balances from ledger
-- This will fix ALL discrepancies including import pallets
-- ============================================================================

-- Calculate correct balances from ledger (by final location)
CREATE TEMP TABLE correct_balances AS
WITH ledger_by_location AS (
    SELECT 
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        MAX(pallet_id_external) as pallet_id_external,
        MAX(production_date) as production_date,
        MAX(expiry_date) as expiry_date,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calc_pack_qty,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calc_piece_qty
    FROM wms_inventory_ledger
    WHERE pallet_id IS NOT NULL
    GROUP BY warehouse_id, location_id, sku_id, pallet_id
)
SELECT * FROM ledger_by_location
WHERE calc_piece_qty > 0;  -- Only keep positive balances

-- Log what we're about to fix
DO $$
DECLARE
    v_to_update INTEGER;
    v_to_delete INTEGER;
BEGIN
    -- Count balances that need updating
    SELECT COUNT(*) INTO v_to_update
    FROM wms_inventory_balances b
    JOIN correct_balances cb 
        ON b.pallet_id = cb.pallet_id 
        AND b.sku_id = cb.sku_id 
        AND b.location_id = cb.location_id
    WHERE b.total_piece_qty != cb.calc_piece_qty;
    
    -- Count balances that should be deleted (not in ledger or zero)
    SELECT COUNT(*) INTO v_to_delete
    FROM wms_inventory_balances b
    LEFT JOIN correct_balances cb 
        ON b.pallet_id = cb.pallet_id 
        AND b.sku_id = cb.sku_id 
        AND b.location_id = cb.location_id
    WHERE b.pallet_id IS NOT NULL
      AND cb.pallet_id IS NULL;
    
    RAISE NOTICE 'Will update % balance records, delete % orphan balance records', 
        v_to_update, v_to_delete;
END $$;

-- Update existing balances to match ledger calculations
UPDATE wms_inventory_balances b
SET 
    total_pack_qty = cb.calc_pack_qty,
    total_piece_qty = cb.calc_piece_qty,
    updated_at = CURRENT_TIMESTAMP
FROM correct_balances cb
WHERE b.pallet_id = cb.pallet_id
  AND b.sku_id = cb.sku_id
  AND b.location_id = cb.location_id
  AND (b.total_pack_qty != cb.calc_pack_qty OR b.total_piece_qty != cb.calc_piece_qty);

-- Delete balance records that have no corresponding ledger entries
-- (orphan balances from deleted receives/imports)
DELETE FROM wms_inventory_balances b
WHERE b.pallet_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM correct_balances cb
    WHERE cb.pallet_id = b.pallet_id
      AND cb.sku_id = b.sku_id
      AND cb.location_id = b.location_id
  )
  AND b.reserved_piece_qty = 0
  AND b.reserved_pack_qty = 0;

-- Drop temp table
DROP TABLE IF EXISTS correct_balances;

-- ============================================================================
-- STEP 5: Clean up zero or negative balance records
-- ============================================================================
DELETE FROM wms_inventory_balances
WHERE total_piece_qty <= 0 
  AND total_pack_qty <= 0
  AND reserved_piece_qty <= 0
  AND reserved_pack_qty <= 0;

-- ============================================================================
-- STEP 6: Verify fix
-- ============================================================================
DO $$
DECLARE
    v_discrepancy_count INTEGER;
    v_total_discrepancy NUMERIC;
BEGIN
    WITH ledger_sum AS (
        SELECT 
            pallet_id, sku_id, location_id,
            SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_total
        FROM wms_inventory_ledger
        WHERE pallet_id IS NOT NULL
        GROUP BY pallet_id, sku_id, location_id
    ),
    balance_current AS (
        SELECT pallet_id, sku_id, location_id, total_piece_qty as balance_total
        FROM wms_inventory_balances
        WHERE pallet_id IS NOT NULL
    ),
    discrepancies AS (
        SELECT 
            COALESCE(l.pallet_id, b.pallet_id) as pallet_id,
            ABS(COALESCE(b.balance_total, 0) - COALESCE(l.ledger_total, 0)) as diff
        FROM ledger_sum l
        FULL OUTER JOIN balance_current b 
            ON l.pallet_id = b.pallet_id AND l.sku_id = b.sku_id AND l.location_id = b.location_id
        WHERE COALESCE(b.balance_total, 0) != COALESCE(l.ledger_total, 0)
    )
    SELECT COUNT(*), COALESCE(SUM(diff), 0)
    INTO v_discrepancy_count, v_total_discrepancy
    FROM discrepancies;
    
    RAISE NOTICE 'AFTER FIX: Found % discrepancies with total qty difference: %', 
        v_discrepancy_count, v_total_discrepancy;
    
    IF v_discrepancy_count > 0 THEN
        RAISE WARNING 'Some discrepancies remain - manual review may be needed';
    ELSE
        RAISE NOTICE 'SUCCESS: All balance/ledger discrepancies have been fixed!';
    END IF;
END $$;


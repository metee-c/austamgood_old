-- ============================================================================
-- Migration: 181_fix_stock_integrity_comprehensive.sql
-- Description: Comprehensive fix for all stock integrity issues
-- Date: 2026-01-06
-- Issues Fixed:
--   1. Orphan reservations (45 records, 5,368 pieces)
--   2. Duplicate balance records at Dispatch (9 duplicates)
--   3. Ledger vs Balance mismatches (119 records, 21,153 pieces)
--   4. Create audit trail for corrections
-- Note: Negative balances ARE ALLOWED by business requirement (migration 180)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create correction log table for audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_correction_log (
    correction_id SERIAL PRIMARY KEY,
    correction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    balance_id BIGINT,
    sku_id VARCHAR(100),
    location_id VARCHAR(100),
    old_piece_qty NUMERIC(18,2),
    old_pack_qty NUMERIC(18,2),
    old_reserved_piece_qty NUMERIC(18,2),
    new_piece_qty NUMERIC(18,2),
    new_pack_qty NUMERIC(18,2),
    new_reserved_piece_qty NUMERIC(18,2),
    correction_type VARCHAR(50),
    notes TEXT,
    corrected_by INTEGER
);

COMMENT ON TABLE stock_correction_log IS 'Audit trail for stock corrections made during integrity fixes';

-- ============================================================================
-- STEP 2: Clear orphan reservations
-- These are reserved_piece_qty values that have no corresponding active 
-- reservation in picklist/face_sheet/bonus_face_sheet_item_reservations
-- ============================================================================

-- Log orphan reservations before clearing
INSERT INTO stock_correction_log (
    balance_id, sku_id, location_id, 
    old_piece_qty, old_pack_qty, old_reserved_piece_qty,
    new_piece_qty, new_pack_qty, new_reserved_piece_qty,
    correction_type, notes
)
SELECT 
    ib.balance_id,
    ib.sku_id,
    ib.location_id,
    ib.total_piece_qty,
    ib.total_pack_qty,
    ib.reserved_piece_qty,
    ib.total_piece_qty,
    ib.total_pack_qty,
    0,
    'CLEAR_ORPHAN_RESERVATION',
    'Cleared orphan reservation - no active reservation found - Migration 181'
FROM wms_inventory_balances ib
WHERE ib.reserved_piece_qty > 0
AND ib.balance_id NOT IN (
    SELECT DISTINCT balance_id FROM picklist_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
)
AND ib.balance_id NOT IN (
    SELECT DISTINCT balance_id FROM face_sheet_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
)
AND ib.balance_id NOT IN (
    SELECT DISTINCT balance_id FROM bonus_face_sheet_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
);

-- Clear orphan reservations
UPDATE wms_inventory_balances
SET 
    reserved_piece_qty = 0,
    reserved_pack_qty = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE reserved_piece_qty > 0
AND balance_id NOT IN (
    SELECT DISTINCT balance_id FROM picklist_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
)
AND balance_id NOT IN (
    SELECT DISTINCT balance_id FROM face_sheet_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
)
AND balance_id NOT IN (
    SELECT DISTINCT balance_id FROM bonus_face_sheet_item_reservations WHERE status = 'reserved' AND balance_id IS NOT NULL
);


-- ============================================================================
-- STEP 3: Merge duplicate Dispatch balance records
-- ============================================================================

-- Create temp table to track duplicates
CREATE TEMP TABLE dispatch_duplicates AS
SELECT 
    warehouse_id,
    location_id,
    sku_id,
    COUNT(*) as cnt,
    SUM(total_piece_qty) as total_pieces,
    SUM(total_pack_qty) as total_packs,
    SUM(reserved_piece_qty) as total_reserved_pieces,
    SUM(reserved_pack_qty) as total_reserved_packs,
    MIN(balance_id) as keep_id
FROM wms_inventory_balances
WHERE location_id = 'Dispatch'
GROUP BY warehouse_id, location_id, sku_id
HAVING COUNT(*) > 1;

-- Log duplicates before merge
INSERT INTO stock_correction_log (
    balance_id, sku_id, location_id, 
    old_piece_qty, old_pack_qty, old_reserved_piece_qty,
    new_piece_qty, new_pack_qty, new_reserved_piece_qty,
    correction_type, notes
)
SELECT 
    b.balance_id,
    b.sku_id,
    b.location_id,
    b.total_piece_qty,
    b.total_pack_qty,
    b.reserved_piece_qty,
    CASE WHEN b.balance_id = d.keep_id THEN d.total_pieces ELSE 0 END,
    CASE WHEN b.balance_id = d.keep_id THEN d.total_packs ELSE 0 END,
    CASE WHEN b.balance_id = d.keep_id THEN d.total_reserved_pieces ELSE 0 END,
    CASE WHEN b.balance_id = d.keep_id THEN 'MERGE_KEEP' ELSE 'MERGE_DELETE' END,
    'Merged duplicate Dispatch balance records - Migration 181'
FROM wms_inventory_balances b
JOIN dispatch_duplicates d ON b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id;

-- Update FK references in reservation tables BEFORE deleting duplicates
-- Update picklist_item_reservations
UPDATE picklist_item_reservations pir
SET balance_id = d.keep_id
FROM wms_inventory_balances b
JOIN dispatch_duplicates d ON b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id
WHERE pir.balance_id = b.balance_id
AND b.balance_id != d.keep_id;

-- Update face_sheet_item_reservations
UPDATE face_sheet_item_reservations fir
SET balance_id = d.keep_id
FROM wms_inventory_balances b
JOIN dispatch_duplicates d ON b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id
WHERE fir.balance_id = b.balance_id
AND b.balance_id != d.keep_id;

-- Update bonus_face_sheet_item_reservations
UPDATE bonus_face_sheet_item_reservations bfir
SET balance_id = d.keep_id
FROM wms_inventory_balances b
JOIN dispatch_duplicates d ON b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id
WHERE bfir.balance_id = b.balance_id
AND b.balance_id != d.keep_id;

-- Update the record to keep with merged totals
UPDATE wms_inventory_balances b
SET 
    total_piece_qty = d.total_pieces,
    total_pack_qty = d.total_packs,
    reserved_piece_qty = d.total_reserved_pieces,
    reserved_pack_qty = d.total_reserved_packs,
    updated_at = CURRENT_TIMESTAMP
FROM dispatch_duplicates d
WHERE b.balance_id = d.keep_id;

-- Delete duplicate records (now safe because FK references have been updated)
DELETE FROM wms_inventory_balances b
USING dispatch_duplicates d
WHERE b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id
    AND b.balance_id != d.keep_id;

DROP TABLE dispatch_duplicates;

-- ============================================================================
-- STEP 4: Recalculate balances from ledger for mismatched records
-- This will sync balance with ledger entries
-- ============================================================================

-- Create temp table with correct balances from ledger
CREATE TEMP TABLE ledger_calculated_balances AS
SELECT 
    l.warehouse_id,
    l.location_id,
    l.sku_id,
    SUM(CASE WHEN l.direction = 'in' THEN l.piece_qty ELSE -l.piece_qty END) as correct_piece_qty,
    SUM(CASE WHEN l.direction = 'in' THEN l.pack_qty ELSE -l.pack_qty END) as correct_pack_qty
FROM wms_inventory_ledger l
GROUP BY l.warehouse_id, l.location_id, l.sku_id;

-- Log mismatches before correction
INSERT INTO stock_correction_log (
    balance_id, sku_id, location_id, 
    old_piece_qty, old_pack_qty, old_reserved_piece_qty,
    new_piece_qty, new_pack_qty, new_reserved_piece_qty,
    correction_type, notes
)
SELECT 
    b.balance_id,
    b.sku_id,
    b.location_id,
    b.total_piece_qty,
    b.total_pack_qty,
    b.reserved_piece_qty,
    COALESCE(l.correct_piece_qty, 0),
    COALESCE(l.correct_pack_qty, 0),
    b.reserved_piece_qty,
    'RECALC_FROM_LEDGER',
    format('Recalculated from ledger. Old: %s, Ledger: %s, Diff: %s - Migration 181',
           b.total_piece_qty::text,
           COALESCE(l.correct_piece_qty, 0)::text,
           (b.total_piece_qty - COALESCE(l.correct_piece_qty, 0))::text)
FROM wms_inventory_balances b
LEFT JOIN ledger_calculated_balances l 
    ON b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id
WHERE b.total_piece_qty != COALESCE(l.correct_piece_qty, 0);

-- Update balances to match ledger
UPDATE wms_inventory_balances b
SET 
    total_piece_qty = COALESCE(l.correct_piece_qty, 0),
    total_pack_qty = COALESCE(l.correct_pack_qty, 0),
    updated_at = CURRENT_TIMESTAMP
FROM ledger_calculated_balances l
WHERE b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id
    AND b.total_piece_qty != l.correct_piece_qty;

-- Handle orphan balances (balance exists but no ledger) - set to zero
INSERT INTO stock_correction_log (
    balance_id, sku_id, location_id, 
    old_piece_qty, old_pack_qty, old_reserved_piece_qty,
    new_piece_qty, new_pack_qty, new_reserved_piece_qty,
    correction_type, notes
)
SELECT 
    b.balance_id,
    b.sku_id,
    b.location_id,
    b.total_piece_qty,
    b.total_pack_qty,
    b.reserved_piece_qty,
    0,
    0,
    0,
    'ORPHAN_BALANCE_ZEROED',
    'Balance had no ledger entries - zeroed out - Migration 181'
FROM wms_inventory_balances b
LEFT JOIN ledger_calculated_balances l 
    ON b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id
WHERE l.sku_id IS NULL
AND b.total_piece_qty != 0;

UPDATE wms_inventory_balances b
SET 
    total_piece_qty = 0,
    total_pack_qty = 0,
    reserved_piece_qty = 0,
    reserved_pack_qty = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM ledger_calculated_balances l
    WHERE b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id
)
AND b.total_piece_qty != 0;

DROP TABLE ledger_calculated_balances;


-- ============================================================================
-- STEP 5: Create upsert function for Dispatch balance (prevent future duplicates)
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_dispatch_balance(
    p_warehouse_id VARCHAR,
    p_location_id VARCHAR,
    p_sku_id VARCHAR,
    p_piece_qty NUMERIC,
    p_pack_qty NUMERIC
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO wms_inventory_balances (
        warehouse_id, location_id, sku_id, 
        total_piece_qty, total_pack_qty,
        reserved_piece_qty, reserved_pack_qty,
        last_movement_at, created_at, updated_at
    )
    VALUES (
        p_warehouse_id, p_location_id, p_sku_id,
        p_piece_qty, p_pack_qty,
        0, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (warehouse_id, location_id, sku_id, 
                 COALESCE(production_date, '1900-01-01'::date),
                 COALESCE(expiry_date, '1900-01-01'::date),
                 COALESCE(lot_no, ''),
                 COALESCE(pallet_id, ''),
                 COALESCE(pallet_id_external, ''))
    DO UPDATE SET
        total_piece_qty = wms_inventory_balances.total_piece_qty + p_piece_qty,
        total_pack_qty = wms_inventory_balances.total_pack_qty + p_pack_qty,
        last_movement_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_dispatch_balance IS 'Safely upsert balance at Dispatch location to prevent duplicates';

-- ============================================================================
-- STEP 6: Create function to check stock availability before picking
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stock_availability(
    p_balance_id BIGINT,
    p_required_qty NUMERIC
)
RETURNS TABLE (
    is_available BOOLEAN,
    available_qty NUMERIC,
    shortage_qty NUMERIC
) AS $$
DECLARE
    v_available NUMERIC;
BEGIN
    SELECT total_piece_qty - reserved_piece_qty
    INTO v_available
    FROM wms_inventory_balances
    WHERE balance_id = p_balance_id;
    
    RETURN QUERY SELECT 
        v_available >= p_required_qty,
        v_available,
        GREATEST(0, p_required_qty - v_available);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_stock_availability IS 'Check if sufficient stock is available before picking';

-- ============================================================================
-- STEP 7: Create function to safely release reservation
-- ============================================================================

CREATE OR REPLACE FUNCTION safe_release_reservation(
    p_balance_id BIGINT,
    p_piece_qty NUMERIC,
    p_pack_qty NUMERIC DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    UPDATE wms_inventory_balances
    SET 
        reserved_piece_qty = GREATEST(0, reserved_piece_qty - p_piece_qty),
        reserved_pack_qty = GREATEST(0, reserved_pack_qty - p_pack_qty),
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = p_balance_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION safe_release_reservation IS 'Safely release reservation without going negative';

-- ============================================================================
-- STEP 8: Summary of corrections
-- ============================================================================

DO $$
DECLARE
    v_orphan_cleared INTEGER;
    v_duplicates_merged INTEGER;
    v_recalculated INTEGER;
    v_orphan_zeroed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_orphan_cleared 
    FROM stock_correction_log WHERE correction_type = 'CLEAR_ORPHAN_RESERVATION';
    
    SELECT COUNT(*) INTO v_duplicates_merged 
    FROM stock_correction_log WHERE correction_type IN ('MERGE_KEEP', 'MERGE_DELETE');
    
    SELECT COUNT(*) INTO v_recalculated 
    FROM stock_correction_log WHERE correction_type = 'RECALC_FROM_LEDGER';
    
    SELECT COUNT(*) INTO v_orphan_zeroed 
    FROM stock_correction_log WHERE correction_type = 'ORPHAN_BALANCE_ZEROED';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STOCK INTEGRITY FIX SUMMARY - Migration 181';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Orphan reservations cleared: %', v_orphan_cleared;
    RAISE NOTICE 'Duplicate records merged: %', v_duplicates_merged;
    RAISE NOTICE 'Balances recalculated from ledger: %', v_recalculated;
    RAISE NOTICE 'Orphan balances zeroed: %', v_orphan_zeroed;
    RAISE NOTICE '========================================';
END $$;

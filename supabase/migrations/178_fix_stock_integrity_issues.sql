-- ============================================================================
-- Migration: 178_fix_stock_integrity_issues.sql
-- Description: Fix critical stock integrity issues found in audit
-- Date: 2026-01-06
-- Issues Fixed:
--   1. Negative balances in preparation areas
--   2. Duplicate balance records at Dispatch
--   3. Pack qty vs piece qty inconsistency
--   4. Add constraints to prevent future issues
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
    new_piece_qty NUMERIC(18,2),
    new_pack_qty NUMERIC(18,2),
    correction_type VARCHAR(50),
    notes TEXT,
    corrected_by INTEGER
);

COMMENT ON TABLE stock_correction_log IS 'Audit trail for stock corrections made during integrity fixes';

-- ============================================================================
-- STEP 2: Log and fix negative balances
-- ============================================================================

-- Log negative balances before correction
INSERT INTO stock_correction_log (balance_id, sku_id, location_id, old_piece_qty, old_pack_qty, new_piece_qty, new_pack_qty, correction_type, notes)
SELECT 
    balance_id,
    sku_id,
    location_id,
    total_piece_qty,
    total_pack_qty,
    0,
    0,
    'NEGATIVE_TO_ZERO',
    'Corrected negative balance caused by over-picking - Migration 178'
FROM wms_inventory_balances
WHERE total_piece_qty < 0 OR total_pack_qty < 0;

-- Set negative balances to zero
UPDATE wms_inventory_balances
SET 
    total_piece_qty = GREATEST(0, total_piece_qty),
    total_pack_qty = GREATEST(0, total_pack_qty),
    updated_at = CURRENT_TIMESTAMP
WHERE total_piece_qty < 0 OR total_pack_qty < 0;

RAISE NOTICE 'Fixed negative balances';

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
INSERT INTO stock_correction_log (balance_id, sku_id, location_id, old_piece_qty, old_pack_qty, new_piece_qty, new_pack_qty, correction_type, notes)
SELECT 
    b.balance_id,
    b.sku_id,
    b.location_id,
    b.total_piece_qty,
    b.total_pack_qty,
    CASE WHEN b.balance_id = d.keep_id THEN d.total_pieces ELSE 0 END,
    CASE WHEN b.balance_id = d.keep_id THEN d.total_packs ELSE 0 END,
    CASE WHEN b.balance_id = d.keep_id THEN 'MERGE_KEEP' ELSE 'MERGE_DELETE' END,
    'Merged duplicate Dispatch balance records - Migration 178'
FROM wms_inventory_balances b
JOIN dispatch_duplicates d ON b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id;

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

-- Delete duplicate records
DELETE FROM wms_inventory_balances b
USING dispatch_duplicates d
WHERE b.warehouse_id = d.warehouse_id 
    AND b.location_id = d.location_id 
    AND b.sku_id = d.sku_id
    AND b.balance_id != d.keep_id;

DROP TABLE dispatch_duplicates;

RAISE NOTICE 'Merged duplicate Dispatch balances';

-- ============================================================================
-- STEP 4: Fix pack_qty inconsistencies (where piece > 0 but pack < 0)
-- ============================================================================

-- Log inconsistent records
INSERT INTO stock_correction_log (balance_id, sku_id, location_id, old_piece_qty, old_pack_qty, new_piece_qty, new_pack_qty, correction_type, notes)
SELECT 
    b.balance_id,
    b.sku_id,
    b.location_id,
    b.total_piece_qty,
    b.total_pack_qty,
    b.total_piece_qty,
    CASE 
        WHEN s.qty_per_pack > 0 THEN b.total_piece_qty / s.qty_per_pack
        ELSE b.total_piece_qty
    END,
    'PACK_QTY_RECALC',
    'Recalculated pack_qty from piece_qty - Migration 178'
FROM wms_inventory_balances b
LEFT JOIN master_sku s ON b.sku_id = s.sku_id
WHERE b.total_piece_qty > 0 AND b.total_pack_qty < 0;

-- Fix pack_qty based on piece_qty and qty_per_pack
UPDATE wms_inventory_balances b
SET 
    total_pack_qty = CASE 
        WHEN s.qty_per_pack > 0 THEN b.total_piece_qty / s.qty_per_pack
        ELSE b.total_piece_qty
    END,
    updated_at = CURRENT_TIMESTAMP
FROM master_sku s
WHERE b.sku_id = s.sku_id
    AND b.total_piece_qty > 0 
    AND b.total_pack_qty < 0;

RAISE NOTICE 'Fixed pack_qty inconsistencies';

-- ============================================================================
-- STEP 5: Create upsert function for Dispatch balance (for picking API)
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
-- STEP 6: Add CHECK constraint to prevent negative balances (NOT VALID first)
-- ============================================================================

-- Add constraint without validating existing data
ALTER TABLE wms_inventory_balances
DROP CONSTRAINT IF EXISTS chk_non_negative_balance;

ALTER TABLE wms_inventory_balances
ADD CONSTRAINT chk_non_negative_balance 
CHECK (total_piece_qty >= 0 AND total_pack_qty >= 0)
NOT VALID;

-- Now validate (will fail if any negative values remain)
ALTER TABLE wms_inventory_balances 
VALIDATE CONSTRAINT chk_non_negative_balance;

RAISE NOTICE 'Added non-negative balance constraint';

-- ============================================================================
-- STEP 7: Create function to check stock availability before picking
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
-- STEP 8: Summary of corrections
-- ============================================================================

DO $$
DECLARE
    v_negative_fixed INTEGER;
    v_duplicates_merged INTEGER;
    v_pack_fixed INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_negative_fixed 
    FROM stock_correction_log WHERE correction_type = 'NEGATIVE_TO_ZERO';
    
    SELECT COUNT(*) INTO v_duplicates_merged 
    FROM stock_correction_log WHERE correction_type IN ('MERGE_KEEP', 'MERGE_DELETE');
    
    SELECT COUNT(*) INTO v_pack_fixed 
    FROM stock_correction_log WHERE correction_type = 'PACK_QTY_RECALC';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STOCK INTEGRITY FIX SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Negative balances fixed: %', v_negative_fixed;
    RAISE NOTICE 'Duplicate records merged: %', v_duplicates_merged;
    RAISE NOTICE 'Pack qty recalculated: %', v_pack_fixed;
    RAISE NOTICE '========================================';
END $$;

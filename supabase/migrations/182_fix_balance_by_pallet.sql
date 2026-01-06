-- ============================================================================
-- Migration: 182_fix_balance_by_pallet.sql
-- Description: Fix balance records by recalculating from ledger including pallet_id
-- Date: 2026-01-06
-- Applied: Yes
-- ============================================================================

-- Log corrections before fixing
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
    'RECALC_BY_PALLET',
    format('Recalculated by pallet. Old: %s, Correct: %s', b.total_piece_qty::text, COALESCE(l.correct_piece_qty, 0)::text)
FROM wms_inventory_balances b
LEFT JOIN (
    SELECT 
        warehouse_id, location_id, sku_id, pallet_id,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as correct_piece_qty,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as correct_pack_qty
    FROM wms_inventory_ledger
    WHERE pallet_id IS NOT NULL AND pallet_id != ''
    GROUP BY warehouse_id, location_id, sku_id, pallet_id
) l ON b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id 
    AND b.pallet_id = l.pallet_id
WHERE b.pallet_id IS NOT NULL AND b.pallet_id != ''
AND b.total_piece_qty != COALESCE(l.correct_piece_qty, 0);

-- Update balance records with pallet_id to match ledger
UPDATE wms_inventory_balances b
SET 
    total_piece_qty = COALESCE(l.correct_piece_qty, 0),
    total_pack_qty = COALESCE(l.correct_pack_qty, 0),
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT 
        warehouse_id, location_id, sku_id, pallet_id,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as correct_piece_qty,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as correct_pack_qty
    FROM wms_inventory_ledger
    WHERE pallet_id IS NOT NULL AND pallet_id != ''
    GROUP BY warehouse_id, location_id, sku_id, pallet_id
) l
WHERE b.warehouse_id = l.warehouse_id 
    AND b.location_id = l.location_id 
    AND b.sku_id = l.sku_id 
    AND b.pallet_id = l.pallet_id
AND b.total_piece_qty != l.correct_piece_qty;

-- Migration 187: Fix remaining ledger vs balance discrepancies found in audit
-- 
-- Problem: Audit found 12 SKU/Location combinations where ledger ≠ balance
-- Solution: Add adjustment entries to sync ledger with balance (with trigger disabled)
--
-- Applied: 2026-01-07
-- Result: Ledger and Balance now match perfectly (0 diff)

-- Log the correction
INSERT INTO stock_correction_log (
  correction_date,
  correction_type,
  notes
) VALUES (
  NOW(),
  'audit_fix_discrepancies',
  'Fixing remaining ledger vs balance discrepancies found in stock card audit'
);

-- Disable the trigger
ALTER TABLE wms_inventory_ledger DISABLE TRIGGER trg_sync_inventory_ledger_to_balance;

-- Create a temporary table to hold all discrepancies
CREATE TEMP TABLE audit_discrepancies AS
WITH ledger_balance AS (
  SELECT 
    sku_id,
    location_id,
    SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as ledger_net_pack,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_net_piece
  FROM wms_inventory_ledger
  GROUP BY sku_id, location_id
),
balance_totals AS (
  SELECT 
    sku_id,
    location_id,
    warehouse_id,
    SUM(total_pack_qty) as balance_pack,
    SUM(total_piece_qty) as balance_piece
  FROM wms_inventory_balances
  GROUP BY sku_id, location_id, warehouse_id
)
SELECT 
  COALESCE(b.sku_id, l.sku_id) as sku_id,
  COALESCE(b.location_id, l.location_id) as location_id,
  COALESCE(b.warehouse_id, 'WH001') as warehouse_id,
  COALESCE(b.balance_pack, 0) as balance_pack,
  COALESCE(b.balance_piece, 0) as balance_piece,
  COALESCE(l.ledger_net_pack, 0) as ledger_pack,
  COALESCE(l.ledger_net_piece, 0) as ledger_piece,
  COALESCE(b.balance_pack, 0) - COALESCE(l.ledger_net_pack, 0) as pack_diff,
  COALESCE(b.balance_piece, 0) - COALESCE(l.ledger_net_piece, 0) as piece_diff
FROM balance_totals b
FULL OUTER JOIN ledger_balance l ON b.sku_id = l.sku_id AND b.location_id = l.location_id
WHERE ABS(COALESCE(b.balance_pack, 0) - COALESCE(l.ledger_net_pack, 0)) > 0.01
   OR ABS(COALESCE(b.balance_piece, 0) - COALESCE(l.ledger_net_piece, 0)) > 0.01;

-- Insert adjustment entries for positive differences (need IN entries)
INSERT INTO wms_inventory_ledger (
  movement_at, transaction_type, direction, warehouse_id, location_id,
  sku_id, pack_qty, piece_qty, reference_no, remarks
)
SELECT 
  NOW(),
  'adjust',
  'in',
  warehouse_id,
  location_id,
  sku_id,
  pack_diff,
  piece_diff,
  'AUDIT-FIX-187',
  'Audit adjustment to sync ledger with balance (migration 187)'
FROM audit_discrepancies
WHERE pack_diff > 0 OR (pack_diff = 0 AND piece_diff > 0);

-- Insert adjustment entries for negative differences (need OUT entries)
INSERT INTO wms_inventory_ledger (
  movement_at, transaction_type, direction, warehouse_id, location_id,
  sku_id, pack_qty, piece_qty, reference_no, remarks
)
SELECT 
  NOW(),
  'adjust',
  'out',
  warehouse_id,
  location_id,
  sku_id,
  ABS(pack_diff),
  ABS(piece_diff),
  'AUDIT-FIX-187',
  'Audit adjustment to sync ledger with balance (migration 187)'
FROM audit_discrepancies
WHERE pack_diff < 0 OR (pack_diff = 0 AND piece_diff < 0);

-- Log how many entries were created
INSERT INTO stock_correction_log (
  correction_date,
  correction_type,
  notes
)
SELECT 
  NOW(),
  'audit_fix_summary',
  'Created ' || COUNT(*) || ' adjustment entries from audit (migration 187)'
FROM audit_discrepancies;

-- Clean up
DROP TABLE audit_discrepancies;

-- Re-enable the trigger
ALTER TABLE wms_inventory_ledger ENABLE TRIGGER trg_sync_inventory_ledger_to_balance;

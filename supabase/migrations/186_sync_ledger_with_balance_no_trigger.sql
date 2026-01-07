-- Migration 186: Sync ledger with balance by disabling trigger first
-- 
-- Problem: Ledger entries are missing, but when we add them, the trigger updates balance too
-- Solution: Disable trigger, add entries, re-enable trigger
--
-- This migration was applied successfully on 2026-01-07
-- Created 50 adjustment entries to sync ledger with balance

-- Log the correction
INSERT INTO stock_correction_log (
  correction_date,
  correction_type,
  notes
) VALUES (
  NOW(),
  'sync_ledger_no_trigger',
  'Syncing ledger with balance by disabling trigger first'
);

-- Disable the trigger
ALTER TABLE wms_inventory_ledger DISABLE TRIGGER trg_sync_inventory_ledger_to_balance;

-- Create a temporary table to hold all discrepancies
CREATE TEMP TABLE ledger_discrepancies AS
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
  b.sku_id,
  b.location_id,
  b.warehouse_id,
  b.balance_pack,
  b.balance_piece,
  COALESCE(l.ledger_net_pack, 0) as ledger_pack,
  COALESCE(l.ledger_net_piece, 0) as ledger_piece,
  b.balance_pack - COALESCE(l.ledger_net_pack, 0) as pack_diff,
  b.balance_piece - COALESCE(l.ledger_net_piece, 0) as piece_diff
FROM balance_totals b
LEFT JOIN ledger_balance l ON b.sku_id = l.sku_id AND b.location_id = l.location_id
WHERE ABS(b.balance_pack - COALESCE(l.ledger_net_pack, 0)) > 0.01;

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
  'LEDGER-SYNC-186',
  'Adjustment entry to sync ledger with balance (migration 186 - trigger disabled)'
FROM ledger_discrepancies
WHERE pack_diff > 0;

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
  'LEDGER-SYNC-186',
  'Adjustment entry to sync ledger with balance (migration 186 - trigger disabled)'
FROM ledger_discrepancies
WHERE pack_diff < 0;

-- Log how many entries were created
INSERT INTO stock_correction_log (
  correction_date,
  correction_type,
  notes
)
SELECT 
  NOW(),
  'ledger_sync_summary',
  'Created ' || COUNT(*) || ' adjustment entries to sync ledger with balance (trigger disabled)'
FROM ledger_discrepancies;

-- Clean up
DROP TABLE ledger_discrepancies;

-- Re-enable the trigger
ALTER TABLE wms_inventory_ledger ENABLE TRIGGER trg_sync_inventory_ledger_to_balance;

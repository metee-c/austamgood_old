-- Migration: Clean up duplicate ledger entries created by both trigger and API
-- Description: Remove duplicate entries while keeping the correct ones
-- Date: 2025-01-21

-- First, identify and remove duplicate move ledger entries
-- Keep only the oldest entry for each unique combination of move_item_id + direction
DELETE FROM wms_inventory_ledger
WHERE ledger_id IN (
  SELECT ledger_id FROM (
    SELECT
      ledger_id,
      ROW_NUMBER() OVER (
        PARTITION BY move_item_id, direction
        ORDER BY created_at ASC, ledger_id ASC
      ) as row_num
    FROM wms_inventory_ledger
    WHERE move_item_id IS NOT NULL
      AND transaction_type IN ('transfer', 'putaway', 'replenishment', 'adjustment')
  ) t
  WHERE t.row_num > 1
);

-- Add a comment
COMMENT ON TABLE wms_inventory_ledger IS 'Inventory movement ledger - cleaned up duplicate entries on 2025-01-21';

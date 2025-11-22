-- Migration: Disable move ledger triggers to prevent duplicate entries
-- Description: The API code already handles ledger creation, so triggers create duplicates
-- Date: 2025-01-21

-- Drop the triggers that create ledger entries from move items
DROP TRIGGER IF EXISTS trg_create_ledger_from_move_insert ON wms_move_items;
DROP TRIGGER IF EXISTS trg_update_ledger_from_move ON wms_move_items;

-- Keep the functions for now in case we need to re-enable them later
-- But add a comment to indicate they are disabled
COMMENT ON FUNCTION create_ledger_from_move() IS 'DISABLED: Create inventory ledger entries (OUT and IN) when move item is inserted with completed status. Disabled because API code handles this.';
COMMENT ON FUNCTION update_ledger_from_move() IS 'DISABLED: Create inventory ledger entries (OUT and IN) when move item status changes to completed. Disabled because API code handles this.';

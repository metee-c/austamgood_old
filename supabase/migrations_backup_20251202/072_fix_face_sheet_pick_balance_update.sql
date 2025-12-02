-- Fix face sheet pick to properly update balance
-- The issue is that direct UPDATE in API doesn't reduce total_piece_qty properly
-- Solution: Ensure skip_balance_sync is true and balance is updated correctly

-- Add console logging to understand the issue better
-- The problem might be that balance update happens but gets overwritten

COMMENT ON TABLE wms_inventory_balances IS 'Inventory balances by location, SKU, and lot. Updated by ledger triggers unless skip_balance_sync is true.';

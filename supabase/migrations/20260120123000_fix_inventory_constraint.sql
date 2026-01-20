
-- Fix unique constraint on wms_inventory_balances
-- Currently, uq_inventory_balances_combo is too restrictive: (warehouse_id, sku_id, location_id, pallet_id)
-- This prevents storing multiple LOTS (different production/expiry dates) of the same SKU in the same Location (if no pallet).
-- We need to include production_date and expiry_date in the unique constraint.

BEGIN;

-- 1. Drop the old restrictive constraint
ALTER TABLE wms_inventory_balances 
  DROP CONSTRAINT IF EXISTS uq_inventory_balances_combo;

-- 2. Create new flexible constraint
-- Using NULLS NOT DISTINCT to handle NULLs correctly (treat them as equal)
ALTER TABLE wms_inventory_balances 
  ADD CONSTRAINT uq_inventory_balances_combo 
  UNIQUE NULLS NOT DISTINCT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date);

COMMIT;

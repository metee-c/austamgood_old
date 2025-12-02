-- Migration: Recalculate all inventory balances from ledger
-- Description: Delete all balances and rebuild from ledger as single source of truth
-- Date: 2025-01-21

-- Step 1: Delete all existing balances
DELETE FROM wms_inventory_balances;

-- Step 2: Rebuild balances from ledger
-- This will sum up all ledger entries grouped by warehouse, location, sku, pallet, etc.
INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date,
    total_pack_qty,
    total_piece_qty,
    reserved_pack_qty,
    reserved_piece_qty,
    last_movement_at,
    created_at,
    updated_at,
    lot_no
)
SELECT
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date,
    SUM(CASE
        WHEN direction = 'in' THEN pack_qty
        WHEN direction = 'out' THEN -pack_qty
        ELSE 0
    END) as total_pack_qty,
    SUM(CASE
        WHEN direction = 'in' THEN piece_qty
        WHEN direction = 'out' THEN -piece_qty
        ELSE 0
    END) as total_piece_qty,
    0 as reserved_pack_qty,
    0 as reserved_piece_qty,
    MAX(movement_at) as last_movement_at,
    MIN(created_at) as created_at,
    CURRENT_TIMESTAMP as updated_at,
    NULL as lot_no
FROM wms_inventory_ledger
WHERE warehouse_id IS NOT NULL
  AND location_id IS NOT NULL
  AND sku_id IS NOT NULL
GROUP BY
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date
HAVING SUM(CASE
    WHEN direction = 'in' THEN piece_qty
    WHEN direction = 'out' THEN -piece_qty
    ELSE 0
END) > 0;  -- Only insert positive balances

-- Add comment
COMMENT ON TABLE wms_inventory_balances IS 'Inventory balances - rebuilt from ledger on 2025-01-21';

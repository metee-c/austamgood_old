-- Migration: Fix pack_qty in ledger and recalculate balances
-- Description: Recalculate pack_qty from piece_qty using SKU pack_size, then rebuild balances
-- Date: 2025-01-22

-- Step 1: Update existing ledger entries to have correct pack_qty
UPDATE wms_inventory_ledger l
SET pack_qty = FLOOR(l.piece_qty / COALESCE(s.qty_per_pack, 1))
FROM master_sku s
WHERE l.sku_id = s.sku_id
  AND s.qty_per_pack > 0;

-- Step 2: Truncate and rebuild balances from corrected ledger
TRUNCATE TABLE wms_inventory_balances RESTART IDENTITY CASCADE;

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
END) > 0;

-- Step 3: Recalculate location quantities from balances
UPDATE master_location ml
SET 
    current_qty = COALESCE((
        SELECT SUM(total_piece_qty)
        FROM wms_inventory_balances
        WHERE location_id = ml.location_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE ml.location_id IS NOT NULL;

-- Show summary
DO $$
DECLARE
    v_ledger_count integer;
    v_balance_count integer;
    v_location_count integer;
BEGIN
    SELECT COUNT(*) INTO v_ledger_count FROM wms_inventory_ledger;
    SELECT COUNT(*) INTO v_balance_count FROM wms_inventory_balances;
    SELECT COUNT(*) INTO v_location_count FROM master_location WHERE current_qty > 0;
    
    RAISE NOTICE 'Pack quantities fixed and balances recalculated:';
    RAISE NOTICE '  - Ledger entries: %', v_ledger_count;
    RAISE NOTICE '  - Balance records: %', v_balance_count;
    RAISE NOTICE '  - Locations with inventory: %', v_location_count;
END $$;

COMMENT ON TABLE wms_inventory_ledger IS 'Inventory ledger - pack_qty recalculated from piece_qty on 2025-01-22';
COMMENT ON TABLE wms_inventory_balances IS 'Inventory balances - rebuilt from corrected ledger on 2025-01-22';

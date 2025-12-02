-- Migration: Sync existing ledger data to balances
-- Description: One-time sync of all existing ledger entries to populate balances table

-- First, clear existing balances (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE wms_inventory_balances RESTART IDENTITY CASCADE;

-- Rebuild balances from ledger
INSERT INTO wms_inventory_balances (
    balance_id,
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
    nextval('wms_inventory_balances_balance_id_seq') as balance_id,
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
    MIN(movement_at) as created_at,
    MAX(movement_at) as updated_at,
    NULL as lot_no
FROM wms_inventory_ledger
GROUP BY 
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date
HAVING SUM(CASE 
    WHEN direction = 'in' THEN pack_qty 
    WHEN direction = 'out' THEN -pack_qty 
    ELSE 0 
END) > 0
OR SUM(CASE 
    WHEN direction = 'in' THEN piece_qty 
    WHEN direction = 'out' THEN -piece_qty 
    ELSE 0 
END) > 0
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE wms_inventory_balances IS 'ตารางคงเหลือสินค้าปัจจุบันตามตำแหน่งจัดเก็บ - Synced from wms_inventory_ledger';

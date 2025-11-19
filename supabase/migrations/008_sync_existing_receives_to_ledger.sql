-- Migration: Sync existing receive records to inventory ledger
-- Description: One-time sync of all existing receives with status 'รับเข้าแล้ว' to create ledger entries

-- Helper function to safely convert string to date
CREATE OR REPLACE FUNCTION safe_string_to_date(date_string text)
RETURNS date AS $$
BEGIN
    IF date_string IS NULL OR date_string = '' THEN
        RETURN NULL;
    END IF;

    RETURN date_string::date;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Insert ledger entries for all existing receives with status 'รับเข้าแล้ว'
INSERT INTO wms_inventory_ledger (
    ledger_id,
    transaction_type,
    receive_item_id,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pallet_id_external,
    production_date,
    expiry_date,
    pack_qty,
    piece_qty,
    direction,
    movement_at,
    created_by
)
SELECT
    nextval('wms_inventory_ledger_ledger_id_seq'),
    'receive',
    i.item_id,
    r.warehouse_id,
    i.location_id,
    i.sku_id,
    i.pallet_id,
    i.pallet_id_external,
    safe_string_to_date(i.production_date),  -- varchar -> date
    i.expiry_date,                            -- already date type
    i.pack_quantity,
    i.piece_quantity,
    'in',
    COALESCE(r.receive_date, i.created_at),
    i.created_by
FROM wms_receive_items i
INNER JOIN wms_receives r ON i.receive_id = r.receive_id
WHERE r.status = 'รับเข้าแล้ว'
AND i.location_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM wms_inventory_ledger l
    WHERE l.receive_item_id = i.item_id
);

-- Show summary of what was synced
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM wms_inventory_ledger
    WHERE receive_item_id IS NOT NULL;

    RAISE NOTICE '✅ Synced % ledger entries from existing receives', v_count;
END $$;

-- Clean up helper function
DROP FUNCTION IF EXISTS safe_string_to_date(text);

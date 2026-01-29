-- Migration 306: Fix receive ledger trigger to support 'สำเร็จ' status
-- Problem: Trigger only creates ledger entries when status changes to 'รับเข้าแล้ว'
--          But some receives are created with status 'สำเร็จ' directly, skipping ledger creation

-- Step 1: Update the trigger function to also handle 'สำเร็จ' status
CREATE OR REPLACE FUNCTION "public"."update_ledger_from_receive_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- When receive status changes to 'รับเข้าแล้ว' OR 'สำเร็จ', create ledger entries for all items
    -- ✅ FIX: Added 'สำเร็จ' to trigger condition
    IF (OLD.status != 'รับเข้าแล้ว' AND NEW.status = 'รับเข้าแล้ว') 
       OR (OLD.status NOT IN ('รับเข้าแล้ว', 'สำเร็จ') AND NEW.status = 'สำเร็จ') THEN
        INSERT INTO wms_inventory_ledger (
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
            'receive',
            i.item_id,
            NEW.warehouse_id,
            i.location_id,
            i.sku_id,
            i.pallet_id,
            i.pallet_id_external,
            safe_string_to_date(i.production_date),  -- Convert varchar to date safely
            i.expiry_date,                            -- already date type
            i.pack_quantity,
            i.piece_quantity,
            'in',
            COALESCE(NEW.receive_date, CURRENT_TIMESTAMP),
            i.created_by
        FROM wms_receive_items i
        WHERE i.receive_id = NEW.receive_id
        AND i.location_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM wms_inventory_ledger l
            WHERE l.receive_item_id = i.item_id
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."update_ledger_from_receive_status"() IS 'Create inventory ledger entries when receive status changes to รับเข้าแล้ว or สำเร็จ - handles varchar to date conversion for production_date';

-- Step 2: Backfill missing ledger entries for receives with status 'สำเร็จ' or 'รับเข้าแล้ว' that don't have ledger entries
INSERT INTO wms_inventory_ledger (
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
    'receive',
    i.item_id,
    r.warehouse_id,
    i.location_id,
    i.sku_id,
    i.pallet_id,
    i.pallet_id_external,
    safe_string_to_date(i.production_date),
    i.expiry_date,
    i.pack_quantity,
    i.piece_quantity,
    'in',
    COALESCE(r.receive_date, r.created_at),
    i.created_by
FROM wms_receive_items i
JOIN wms_receives r ON r.receive_id = i.receive_id
WHERE r.status IN ('รับเข้าแล้ว', 'สำเร็จ')
AND i.location_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM wms_inventory_ledger l
    WHERE l.receive_item_id = i.item_id
);

-- Migration: Add trigger to create inventory ledger entries when receiving items
-- Description: Automatically insert into wms_inventory_ledger when wms_receive_items are created with status 'รับเข้าแล้ว'

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

-- Function to create ledger entries from receive items
CREATE OR REPLACE FUNCTION create_ledger_from_receive()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
BEGIN
    -- Get the receive header status and warehouse_id
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Only create ledger entry if status is 'รับเข้าแล้ว' and location is specified
    IF v_receive_status = 'รับเข้าแล้ว' AND NEW.location_id IS NOT NULL THEN
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
        ) VALUES (
            nextval('wms_inventory_ledger_ledger_id_seq'),
            'receive',
            NEW.item_id,
            v_warehouse_id,
            NEW.location_id,
            NEW.sku_id,
            NEW.pallet_id,
            NEW.pallet_id_external,
            safe_string_to_date(NEW.production_date),  -- varchar -> date
            NEW.expiry_date,                            -- already date type
            NEW.pack_quantity,
            NEW.piece_quantity,
            'in',
            COALESCE(v_receive_date, CURRENT_TIMESTAMP),
            NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_receive_items (INSERT)
DROP TRIGGER IF EXISTS trg_create_ledger_from_receive_insert ON wms_receive_items;

CREATE TRIGGER trg_create_ledger_from_receive_insert
    AFTER INSERT ON wms_receive_items
    FOR EACH ROW
    EXECUTE FUNCTION create_ledger_from_receive();

-- Create trigger on wms_receive_items (UPDATE)
-- This handles cases where items are added first, then status is changed to 'รับเข้าแล้ว'
CREATE OR REPLACE FUNCTION update_ledger_from_receive()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
    v_ledger_exists boolean;
BEGIN
    -- Get the receive header status and warehouse_id
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Check if ledger entry already exists
    SELECT EXISTS(
        SELECT 1 FROM wms_inventory_ledger
        WHERE receive_item_id = NEW.item_id
    ) INTO v_ledger_exists;

    -- Only create ledger entry if:
    -- 1. Status is 'รับเข้าแล้ว'
    -- 2. Location is specified
    -- 3. Ledger entry doesn't already exist
    IF v_receive_status = 'รับเข้าแล้ว'
       AND NEW.location_id IS NOT NULL
       AND NOT v_ledger_exists THEN
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
        ) VALUES (
            nextval('wms_inventory_ledger_ledger_id_seq'),
            'receive',
            NEW.item_id,
            v_warehouse_id,
            NEW.location_id,
            NEW.sku_id,
            NEW.pallet_id,
            NEW.pallet_id_external,
            safe_string_to_date(NEW.production_date),  -- varchar -> date
            NEW.expiry_date,                            -- already date type
            NEW.pack_quantity,
            NEW.piece_quantity,
            'in',
            COALESCE(v_receive_date, CURRENT_TIMESTAMP),
            NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ledger_from_receive ON wms_receive_items;

CREATE TRIGGER trg_update_ledger_from_receive
    AFTER UPDATE ON wms_receive_items
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_from_receive();

-- Also need trigger on wms_receives to handle status change
CREATE OR REPLACE FUNCTION update_ledger_from_receive_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When receive status changes to 'รับเข้าแล้ว', create ledger entries for all items
    IF OLD.status != 'รับเข้าแล้ว' AND NEW.status = 'รับเข้าแล้ว' THEN
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
            NEW.warehouse_id,
            i.location_id,
            i.sku_id,
            i.pallet_id,
            i.pallet_id_external,
            safe_string_to_date(i.production_date),  -- varchar -> date
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ledger_from_receive_status ON wms_receives;

CREATE TRIGGER trg_update_ledger_from_receive_status
    AFTER UPDATE ON wms_receives
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_from_receive_status();

-- Add comments
COMMENT ON FUNCTION safe_string_to_date(text) IS 'Safely convert string to date, returns NULL on error';
COMMENT ON FUNCTION create_ledger_from_receive() IS 'Create inventory ledger entry when receive item is inserted';
COMMENT ON FUNCTION update_ledger_from_receive() IS 'Create inventory ledger entry when receive item is updated';
COMMENT ON FUNCTION update_ledger_from_receive_status() IS 'Create inventory ledger entries when receive status changes to รับเข้าแล้ว';

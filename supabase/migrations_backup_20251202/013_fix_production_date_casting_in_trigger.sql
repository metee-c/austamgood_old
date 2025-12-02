-- Migration: Fix production_date casting in receive to ledger trigger
-- Description: Update safe_string_to_date function to handle both varchar and date types properly

-- Drop and recreate the safe_string_to_date function with better error handling
DROP FUNCTION IF EXISTS safe_string_to_date(text);

CREATE OR REPLACE FUNCTION safe_string_to_date(date_input text)
RETURNS date AS $$
BEGIN
    -- Handle NULL or empty string
    IF date_input IS NULL OR TRIM(date_input) = '' THEN
        RETURN NULL;
    END IF;

    -- Try to cast to date
    RETURN date_input::date;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return NULL
        RAISE WARNING 'Failed to convert % to date: %', date_input, SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the create_ledger_from_receive function to ensure proper casting
CREATE OR REPLACE FUNCTION create_ledger_from_receive()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
    v_production_date date;
BEGIN
    -- Get the receive header status and warehouse_id
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Only create ledger entry if status is 'รับเข้าแล้ว' and location is specified
    IF v_receive_status = 'รับเข้าแล้ว' AND NEW.location_id IS NOT NULL THEN
        -- Safely convert production_date (varchar) to date
        v_production_date := safe_string_to_date(NEW.production_date);
        
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
            v_production_date,      -- Use the converted date variable
            NEW.expiry_date,        -- already date type
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

-- Update the update_ledger_from_receive function similarly
CREATE OR REPLACE FUNCTION update_ledger_from_receive()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp;
    v_production_date date;
    v_ledger_exists boolean;
BEGIN
    -- Get the receive header status
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Check if ledger entry already exists for this item
    SELECT EXISTS(
        SELECT 1 FROM wms_inventory_ledger
        WHERE receive_item_id = NEW.item_id
    ) INTO v_ledger_exists;

    -- If status changed to 'รับเข้าแล้ว' and location is specified and ledger doesn't exist yet
    IF v_receive_status = 'รับเข้าแล้ว' 
       AND NEW.location_id IS NOT NULL 
       AND NOT v_ledger_exists THEN
        
        -- Safely convert production_date (varchar) to date
        v_production_date := safe_string_to_date(NEW.production_date);
        
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
            v_production_date,      -- Use the converted date variable
            NEW.expiry_date,        -- already date type
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

COMMENT ON FUNCTION safe_string_to_date(text) IS 'Safely converts varchar to date, returns NULL on error';
COMMENT ON FUNCTION create_ledger_from_receive() IS 'Trigger function to create ledger entries from receive items on INSERT';
COMMENT ON FUNCTION update_ledger_from_receive() IS 'Trigger function to create ledger entries from receive items on UPDATE';

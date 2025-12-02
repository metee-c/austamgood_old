-- Migration: Fix update_ledger_from_receive_status trigger to handle production_date properly
-- Description: Update the trigger that fires when receive status changes to handle varchar to date conversion

-- Ensure safe_string_to_date function exists with proper implementation
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

-- Update the trigger function that handles status changes
CREATE OR REPLACE FUNCTION update_ledger_from_receive_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When receive status changes to 'รับเข้าแล้ว', create ledger entries for all items
    IF OLD.status != 'รับเข้าแล้ว' AND NEW.status = 'รับเข้าแล้ว' THEN
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
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_update_ledger_from_receive_status ON wms_receives;

CREATE TRIGGER trg_update_ledger_from_receive_status
    AFTER UPDATE ON wms_receives
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_from_receive_status();

COMMENT ON FUNCTION update_ledger_from_receive_status() IS 'Create inventory ledger entries when receive status changes to รับเข้าแล้ว - handles varchar to date conversion for production_date';

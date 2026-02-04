-- ============================================================================
-- Migration: Fix created_by lookup in ledger triggers
-- Description: Update triggers to lookup user_id from master_system_user 
--              based on employee_id, or use NULL if not found
-- Issue: FK constraint fk_inventory_ledger_created_by references master_system_user(user_id)
--        but receive items may have employee_id values that don't exist in master_system_user
-- ============================================================================

-- Update the create_ledger_from_receive trigger function
CREATE OR REPLACE FUNCTION "public"."create_ledger_from_receive"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_receive_status text;
    v_warehouse_id text;
    v_receive_date timestamp with time zone;
    v_production_date date;
    v_user_id bigint;
BEGIN
    -- Get the receive header info
    SELECT status, warehouse_id, receive_date
    INTO v_receive_status, v_warehouse_id, v_receive_date
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Only create ledger entry if status is 'รับเข้าแล้ว' and location is specified
    IF v_receive_status = 'รับเข้าแล้ว' AND NEW.location_id IS NOT NULL THEN
        -- Safely convert production_date (varchar) to date
        v_production_date := safe_string_to_date(NEW.production_date);
        
        -- Lookup user_id: First try direct match, then try via employee_id
        SELECT user_id INTO v_user_id
        FROM master_system_user
        WHERE user_id = NEW.created_by
        LIMIT 1;
        
        -- If not found by user_id, try to find by employee_id
        IF v_user_id IS NULL AND NEW.created_by IS NOT NULL THEN
            SELECT user_id INTO v_user_id
            FROM master_system_user
            WHERE employee_id = NEW.created_by
            LIMIT 1;
        END IF;
        
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
            v_production_date,
            NEW.expiry_date,
            NEW.pack_quantity,
            NEW.piece_quantity,
            'in',
            COALESCE(v_receive_date, CURRENT_TIMESTAMP),
            v_user_id  -- Use looked up user_id (may be NULL)
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."create_ledger_from_receive"() IS 'Trigger function to create ledger entries from receive items on INSERT - with user_id lookup fix';

-- Update the update_ledger_from_receive_status trigger function
CREATE OR REPLACE FUNCTION "public"."update_ledger_from_receive_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
            safe_string_to_date(i.production_date),
            i.expiry_date,
            i.pack_quantity,
            i.piece_quantity,
            'in',
            COALESCE(NEW.receive_date, CURRENT_TIMESTAMP),
            -- Lookup user_id: First try direct match, then try via employee_id
            COALESCE(
                (SELECT user_id FROM master_system_user WHERE user_id = i.created_by LIMIT 1),
                (SELECT user_id FROM master_system_user WHERE employee_id = i.created_by LIMIT 1)
            )
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

COMMENT ON FUNCTION "public"."update_ledger_from_receive_status"() IS 'Create inventory ledger entries when receive status changes to รับเข้าแล้ว - with user_id lookup fix';

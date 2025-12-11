-- ============================================================================
-- Migration: Add user tracking to inventory ledger
-- Description: Update triggers to capture created_by from session variable
-- ============================================================================

-- Create helper function to set PostgreSQL config
CREATE OR REPLACE FUNCTION wms_set_config(
  setting_name TEXT,
  setting_value TEXT,
  is_local BOOLEAN DEFAULT true
) RETURNS TEXT AS $$
BEGIN
  PERFORM pg_catalog.set_config(setting_name, setting_value, is_local);
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get current user from session
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS BIGINT AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  BEGIN
    v_user_id := current_setting('app.current_user_id', true);
    IF v_user_id IS NULL OR v_user_id = '' THEN
      RETURN NULL;
    END IF;
    RETURN v_user_id::BIGINT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update trigger: create_ledger_from_move_item
-- ============================================================================
CREATE OR REPLACE FUNCTION create_ledger_from_move_item()
RETURNS TRIGGER AS $$
DECLARE
    v_sku_id VARCHAR(50);
    v_warehouse_id VARCHAR(50);
    v_pallet_id VARCHAR(50);
    v_pallet_id_external VARCHAR(50);
    v_lot_no VARCHAR(100);
    v_production_date DATE;
    v_expiry_date DATE;
    v_user_id BIGINT;
BEGIN
    -- Get user_id from session
    v_user_id := get_current_user_id();

    -- Only process if status is 'completed'
    IF NEW.status = 'completed' THEN
        -- Get SKU and warehouse info from the move header
        SELECT m.sku_id, m.warehouse_id, m.pallet_id, m.pallet_id_external, m.lot_no, m.production_date, m.expiry_date
        INTO v_sku_id, v_warehouse_id, v_pallet_id, v_pallet_id_external, v_lot_no, v_production_date, v_expiry_date
        FROM wms_moves m
        WHERE m.move_id = NEW.move_id;

        -- Create OUT entry (from source location)
        IF NEW.from_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                lot_no,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                transaction_date,
                reference_no,
                notes,
                created_by
            ) VALUES (
                'move_out',
                NEW.move_item_id,
                v_warehouse_id,
                NEW.from_location_id,
                v_sku_id,
                v_pallet_id,
                v_pallet_id_external,
                v_lot_no,
                v_production_date,
                v_expiry_date,
                -NEW.pack_qty,
                -NEW.piece_qty,
                NEW.completed_at,
                NEW.move_id::TEXT,
                'Stock moved out from ' || NEW.from_location_id,
                v_user_id
            );
        END IF;

        -- Create IN entry (to destination location)
        IF NEW.to_location_id IS NOT NULL THEN
            INSERT INTO wms_inventory_ledger (
                transaction_type,
                move_item_id,
                warehouse_id,
                location_id,
                sku_id,
                pallet_id,
                pallet_id_external,
                lot_no,
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                transaction_date,
                reference_no,
                notes,
                created_by
            ) VALUES (
                'move_in',
                NEW.move_item_id,
                v_warehouse_id,
                NEW.to_location_id,
                v_sku_id,
                v_pallet_id,
                v_pallet_id_external,
                v_lot_no,
                v_production_date,
                v_expiry_date,
                NEW.pack_qty,
                NEW.piece_qty,
                NEW.completed_at,
                NEW.move_id::TEXT,
                'Stock moved in to ' || NEW.to_location_id,
                v_user_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Update trigger: create_ledger_from_receive_item
-- ============================================================================
CREATE OR REPLACE FUNCTION create_ledger_from_receive_item()
RETURNS TRIGGER AS $$
DECLARE
    v_receive_status VARCHAR(50);
    v_production_date DATE;
    v_expiry_date DATE;
    v_user_id BIGINT;
BEGIN
    -- Get user_id from session
    v_user_id := get_current_user_id();

    -- Get receive status
    SELECT status INTO v_receive_status
    FROM wms_receives
    WHERE receive_id = NEW.receive_id;

    -- Convert string dates to DATE type safely
    v_production_date := safe_string_to_date(NEW.production_date);
    v_expiry_date := safe_string_to_date(NEW.expiry_date);
    
    INSERT INTO wms_inventory_ledger (
        ledger_id,
        transaction_type,
        receive_item_id,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        pallet_id_external,
        lot_no,
        production_date,
        expiry_date,
        pack_qty,
        piece_qty,
        transaction_date,
        reference_no,
        notes,
        created_by
    ) VALUES (
        NEW.receive_item_id,
        'receive',
        NEW.receive_item_id,
        NEW.warehouse_id,
        NEW.location_id,
        NEW.sku_id,
        NEW.pallet_id,
        NEW.pallet_id_external,
        NEW.lot_no,
        v_production_date,
        v_expiry_date,
        NEW.pack_qty,
        NEW.piece_qty,
        NEW.received_at,
        NEW.receive_id::TEXT,
        'Goods received',
        v_user_id
    )
    ON CONFLICT (ledger_id) DO UPDATE SET
        warehouse_id = EXCLUDED.warehouse_id,
        location_id = EXCLUDED.location_id,
        sku_id = EXCLUDED.sku_id,
        pallet_id = EXCLUDED.pallet_id,
        pallet_id_external = EXCLUDED.pallet_id_external,
        lot_no = EXCLUDED.lot_no,
        production_date = EXCLUDED.production_date,
        expiry_date = EXCLUDED.expiry_date,
        pack_qty = EXCLUDED.pack_qty,
        piece_qty = EXCLUDED.piece_qty,
        transaction_date = EXCLUDED.transaction_date,
        updated_at = NOW(),
        created_by = COALESCE(wms_inventory_ledger.created_by, v_user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Update trigger: create_ledger_from_receive_status_change
-- ============================================================================
CREATE OR REPLACE FUNCTION create_ledger_from_receive_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id BIGINT;
BEGIN
    -- Get user_id from session
    v_user_id := get_current_user_id();

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
            lot_no,
            production_date,
            expiry_date,
            pack_qty,
            piece_qty,
            transaction_date,
            reference_no,
            notes,
            created_by
        )
        SELECT
            'receive',
            ri.receive_item_id,
            ri.warehouse_id,
            ri.location_id,
            ri.sku_id,
            ri.pallet_id,
            ri.pallet_id_external,
            ri.lot_no,
            safe_string_to_date(ri.production_date),
            safe_string_to_date(ri.expiry_date),
            ri.pack_qty,
            ri.piece_qty,
            ri.received_at,
            NEW.receive_id::TEXT,
            'Goods received (status change)',
            v_user_id
        FROM wms_receive_items ri
        WHERE ri.receive_id = NEW.receive_id
        AND ri.location_id IS NOT NULL
        ON CONFLICT (ledger_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION wms_set_config(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated;

COMMENT ON FUNCTION wms_set_config IS 'Set PostgreSQL configuration parameter for current session';
COMMENT ON FUNCTION get_current_user_id IS 'Get current user ID from session variable app.current_user_id';

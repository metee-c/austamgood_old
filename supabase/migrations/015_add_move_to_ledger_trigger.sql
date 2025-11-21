-- Migration: Add trigger to create inventory ledger entries when moving items
-- Description: Automatically insert into wms_inventory_ledger when wms_move_items are completed

-- Function to create ledger entries from move items
CREATE OR REPLACE FUNCTION create_ledger_from_move()
RETURNS TRIGGER AS $$
DECLARE
    v_move_status text;
    v_from_warehouse_id text;
    v_to_warehouse_id text;
    v_scheduled_at timestamp;
BEGIN
    -- Get the move header info
    SELECT status, from_warehouse_id, to_warehouse_id, scheduled_at
    INTO v_move_status, v_from_warehouse_id, v_to_warehouse_id, v_scheduled_at
    FROM wms_moves
    WHERE move_id = NEW.move_id;

    -- Only create ledger entries if item status is 'completed'
    IF NEW.status = 'completed' THEN
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
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_from_warehouse_id,
                NEW.from_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'out',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
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
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_to_warehouse_id,
                NEW.to_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'in',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_move_items (INSERT)
DROP TRIGGER IF EXISTS trg_create_ledger_from_move_insert ON wms_move_items;

CREATE TRIGGER trg_create_ledger_from_move_insert
    AFTER INSERT ON wms_move_items
    FOR EACH ROW
    EXECUTE FUNCTION create_ledger_from_move();

-- Function to handle status updates
CREATE OR REPLACE FUNCTION update_ledger_from_move()
RETURNS TRIGGER AS $$
DECLARE
    v_move_status text;
    v_from_warehouse_id text;
    v_to_warehouse_id text;
    v_scheduled_at timestamp;
    v_ledger_exists boolean;
BEGIN
    -- Get the move header info
    SELECT status, from_warehouse_id, to_warehouse_id, scheduled_at
    INTO v_move_status, v_from_warehouse_id, v_to_warehouse_id, v_scheduled_at
    FROM wms_moves
    WHERE move_id = NEW.move_id;

    -- Check if ledger entries already exist for this move item
    SELECT EXISTS(
        SELECT 1 FROM wms_inventory_ledger
        WHERE move_item_id = NEW.move_item_id
    ) INTO v_ledger_exists;

    -- If status changed to 'completed' and ledger doesn't exist yet
    IF OLD.status != 'completed' AND NEW.status = 'completed' AND NOT v_ledger_exists THEN
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
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_from_warehouse_id,
                NEW.from_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'out',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
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
                production_date,
                expiry_date,
                pack_qty,
                piece_qty,
                direction,
                movement_at,
                reference_no,
                created_by
            ) VALUES (
                'transfer',
                NEW.move_item_id,
                v_to_warehouse_id,
                NEW.to_location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.confirmed_pack_qty,
                NEW.confirmed_piece_qty,
                'in',
                COALESCE(NEW.completed_at, v_scheduled_at, CURRENT_TIMESTAMP),
                (SELECT move_no FROM wms_moves WHERE move_id = NEW.move_id),
                NEW.executed_by
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_move_items (UPDATE)
DROP TRIGGER IF EXISTS trg_update_ledger_from_move ON wms_move_items;

CREATE TRIGGER trg_update_ledger_from_move
    AFTER UPDATE ON wms_move_items
    FOR EACH ROW
    EXECUTE FUNCTION update_ledger_from_move();

-- Add comments
COMMENT ON FUNCTION create_ledger_from_move() IS 'Create inventory ledger entries (OUT and IN) when move item is inserted with completed status';
COMMENT ON FUNCTION update_ledger_from_move() IS 'Create inventory ledger entries (OUT and IN) when move item status changes to completed';

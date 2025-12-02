-- Migration: Add trigger to sync inventory ledger to balances
-- Description: Automatically update wms_inventory_balances when new entries are added to wms_inventory_ledger

-- Function to sync inventory ledger to balances
CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_id bigint;
    v_current_pack_qty numeric(18,2);
    v_current_piece_qty numeric(18,2);
BEGIN
    -- Calculate the signed quantity based on direction
    IF NEW.direction = 'in' THEN
        v_current_pack_qty := NEW.pack_qty;
        v_current_piece_qty := NEW.piece_qty;
    ELSE -- direction = 'out'
        v_current_pack_qty := -NEW.pack_qty;
        v_current_piece_qty := -NEW.piece_qty;
    END IF;

    -- Check if balance record exists
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND COALESCE(location_id, '') = COALESCE(NEW.location_id, '')
      AND sku_id = NEW.sku_id
      AND COALESCE(pallet_id, '') = COALESCE(NEW.pallet_id, '')
      AND COALESCE(pallet_id_external, '') = COALESCE(NEW.pallet_id_external, '')
      AND COALESCE(production_date::text, '') = COALESCE(NEW.production_date::text, '')
      AND COALESCE(expiry_date::text, '') = COALESCE(NEW.expiry_date::text, '');

    IF v_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET 
            total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
            total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
            last_movement_at = NEW.movement_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;
    ELSE
        -- Insert new balance record (only if direction is 'in')
        IF NEW.direction = 'in' THEN
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
            ) VALUES (
                nextval('wms_inventory_balances_balance_id_seq'),
                NEW.warehouse_id,
                NEW.location_id,
                NEW.sku_id,
                NEW.pallet_id,
                NEW.pallet_id_external,
                NEW.production_date,
                NEW.expiry_date,
                NEW.pack_qty,
                NEW.piece_qty,
                0,
                0,
                NEW.movement_at,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                NULL -- lot_no can be added if available
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on wms_inventory_ledger
DROP TRIGGER IF EXISTS trg_sync_inventory_ledger_to_balance ON wms_inventory_ledger;

CREATE TRIGGER trg_sync_inventory_ledger_to_balance
    AFTER INSERT ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION sync_inventory_ledger_to_balance();

-- Add comment
COMMENT ON FUNCTION sync_inventory_ledger_to_balance() IS 'Automatically sync inventory ledger entries to balance table';

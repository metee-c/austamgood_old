-- Fix UUID type mismatch in triggers
-- Problem: balance_id is bigint in table but declared as UUID in triggers

-- Fix sync_inventory_ledger_to_balance trigger
CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_id BIGINT;  -- Changed from UUID to BIGINT
  v_lookup_pallet_id TEXT;
  v_delta_pack_qty INTEGER;
  v_delta_piece_qty INTEGER;
BEGIN
  -- ✅ ใช้ pallet_id หรือ pallet_id_external (ตามลำดับความสำคัญ)
  v_lookup_pallet_id := COALESCE(NEW.pallet_id, NEW.pallet_id_external, '');

  -- Calculate delta based on direction
  IF NEW.direction = 'in' THEN
    v_delta_pack_qty := NEW.pack_qty;
    v_delta_piece_qty := NEW.piece_qty;
  ELSE
    v_delta_pack_qty := -NEW.pack_qty;
    v_delta_piece_qty := -NEW.piece_qty;
  END IF;

  -- Check if balance record exists
  SELECT balance_id INTO v_balance_id
  FROM wms_inventory_balances
  WHERE warehouse_id = NEW.warehouse_id
    AND location_id = NEW.location_id
    AND sku_id = NEW.sku_id
    AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(NEW.production_date, '1900-01-01'::date)
    AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(NEW.expiry_date, '1900-01-01'::date)
    AND COALESCE(lot_no, '') = COALESCE(NEW.lot_no, '')
    AND COALESCE(pallet_id, '') = v_lookup_pallet_id;

  IF v_balance_id IS NOT NULL THEN
    -- Update existing balance
    UPDATE wms_inventory_balances
    SET
        total_pack_qty = GREATEST(0, total_pack_qty + v_delta_pack_qty),
        total_piece_qty = GREATEST(0, total_piece_qty + v_delta_piece_qty),
        last_movement_at = NEW.movement_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE balance_id = v_balance_id;
  ELSE
    -- Insert new balance record (only if direction is 'in')
    IF NEW.direction = 'in' THEN
      INSERT INTO wms_inventory_balances (
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
        NEW.lot_no
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_inventory_ledger_to_balance ON wms_inventory_ledger;
CREATE TRIGGER trigger_sync_inventory_ledger_to_balance
  AFTER INSERT ON wms_inventory_ledger
  FOR EACH ROW
  WHEN (NEW.skip_balance_sync IS NOT TRUE)
  EXECUTE FUNCTION sync_inventory_ledger_to_balance();

-- Fix cleanup_inventory_on_receive_delete function
CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_receive_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_ledger RECORD;
    v_balance_id BIGINT;  -- Changed from UUID to BIGINT
BEGIN
    RAISE NOTICE 'Cleaning up inventory for receive_id: %', OLD.receive_id;
    
    -- Loop through all receive items for this receive
    FOR v_item IN 
        SELECT item_id, sku_id, pack_qty, piece_qty, pallet_id
        FROM wms_receive_items
        WHERE receive_id = OLD.receive_id
    LOOP
        RAISE NOTICE 'Processing receive_item: %, sku: %, pack_qty: %, piece_qty: %', 
            v_item.item_id, v_item.sku_id, v_item.pack_qty, v_item.piece_qty;
        
        -- Find corresponding ledger entries
        FOR v_ledger IN
            SELECT ledger_id, warehouse_id, location_id, sku_id, pallet_id
            FROM wms_inventory_ledger
            WHERE reference_no = OLD.receive_no
              AND sku_id = v_item.sku_id
              AND pallet_id = v_item.pallet_id
        LOOP
            RAISE NOTICE 'Found ledger entry: %', v_ledger.ledger_id;
            
            -- Find balance record
            SELECT balance_id INTO v_balance_id
            FROM wms_inventory_balances
            WHERE warehouse_id = v_ledger.warehouse_id
              AND location_id = v_ledger.location_id
              AND sku_id = v_ledger.sku_id
              AND pallet_id = v_ledger.pallet_id;
            
            IF v_balance_id IS NOT NULL THEN
                -- Update balance (subtract quantities)
                UPDATE wms_inventory_balances
                SET
                    total_pack_qty = GREATEST(0, total_pack_qty - v_item.pack_qty),
                    total_piece_qty = GREATEST(0, total_piece_qty - v_item.piece_qty),
                    updated_at = CURRENT_TIMESTAMP
                WHERE balance_id = v_balance_id;
                
                RAISE NOTICE 'Updated balance %: subtracted pack=% piece=%', 
                    v_balance_id, v_item.pack_qty, v_item.piece_qty;
            END IF;
            
            -- Delete ledger entry
            DELETE FROM wms_inventory_ledger
            WHERE ledger_id = v_ledger.ledger_id;
            
            RAISE NOTICE 'Deleted ledger entry %', v_ledger.ledger_id;
        END LOOP;
    END LOOP;
    
    RETURN OLD;
END;
$function$;

-- ============================================================================
-- Fix sync_inventory_ledger_to_balance trigger function
-- ปัญหา: wms_inventory_ledger ไม่มี column lot_no
-- แก้ไข: ลบ lot_no ออกจาก lookup และ insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_inventory_ledger_to_balance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_balance_id bigint;
    v_current_pack_qty numeric(18,2);
    v_current_piece_qty numeric(18,2);
BEGIN
    -- ✅ เช็ค flag skip_balance_sync ก่อนทำงาน
    IF NEW.skip_balance_sync = TRUE THEN
        RAISE NOTICE 'Skipping balance sync for ledger entry % (skip_balance_sync = TRUE)', NEW.ledger_id;
        RETURN NEW;
    END IF;

    -- Calculate the signed quantity based on direction
    IF NEW.direction = 'in' THEN
        v_current_pack_qty := NEW.pack_qty;
        v_current_piece_qty := NEW.piece_qty;
    ELSE -- direction = 'out'
        v_current_pack_qty := -NEW.pack_qty;
        v_current_piece_qty := -NEW.piece_qty;
    END IF;

    -- Check if balance record exists
    -- ✅ ใช้ COALESCE logic เดียวกับ unique constraint (wms_inventory_balances_unique_idx)
    -- Note: lot_no ไม่มีใน wms_inventory_ledger จึงใช้ '' เป็นค่า default
    SELECT balance_id INTO v_balance_id
    FROM wms_inventory_balances
    WHERE warehouse_id = NEW.warehouse_id
      AND location_id = NEW.location_id
      AND sku_id = NEW.sku_id
      AND COALESCE(production_date, '1900-01-01'::date) = COALESCE(NEW.production_date, '1900-01-01'::date)
      AND COALESCE(expiry_date, '1900-01-01'::date) = COALESCE(NEW.expiry_date, '1900-01-01'::date)
      AND COALESCE(lot_no, '') = '';

    IF v_balance_id IS NOT NULL THEN
        -- Update existing balance
        UPDATE wms_inventory_balances
        SET
            total_pack_qty = GREATEST(0, total_pack_qty + v_current_pack_qty),
            total_piece_qty = GREATEST(0, total_piece_qty + v_current_piece_qty),
            last_movement_at = NEW.movement_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE balance_id = v_balance_id;

        RAISE NOTICE 'Updated balance % for SKU % at location %', v_balance_id, NEW.sku_id, NEW.location_id;
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
                NULL -- lot_no ไม่มีใน ledger
            );

            RAISE NOTICE 'Created new balance for SKU % at location %', NEW.sku_id, NEW.location_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sync_inventory_ledger_to_balance() IS 
'Trigger function to sync inventory ledger entries to balance table.
Fixed: COALESCE logic now matches unique constraint.
Note: lot_no is not available in wms_inventory_ledger, so it defaults to NULL/empty.';

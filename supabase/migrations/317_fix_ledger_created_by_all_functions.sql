-- ============================================================================
-- Migration 317: Fix created_by in all ledger-creating functions
-- Description: Add created_by parameter to functions that create ledger entries
--              and backfill NULL created_by with system user (1)
-- ============================================================================

-- ============================================================================
-- PART 1: Backfill NULL created_by with system user (1)
-- ============================================================================

-- Update all ledger entries with NULL created_by to use system user (1)
UPDATE wms_inventory_ledger
SET created_by = 1
WHERE created_by IS NULL;

-- Log the update
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM wms_inventory_ledger WHERE created_by = 1;
  RAISE NOTICE 'Updated % ledger entries with created_by = 1 (system user)', v_count;
END $$;

-- ============================================================================
-- PART 2: Fix atomic_online_pack_stock_move to ensure created_by is set
-- ============================================================================

-- The function already accepts p_user_id, but we need to ensure it defaults to 1 if NULL
CREATE OR REPLACE FUNCTION atomic_online_pack_stock_move(
    p_order_number VARCHAR,
    p_tracking_number VARCHAR,
    p_platform VARCHAR,
    p_items JSONB,
    p_user_id BIGINT DEFAULT 1  -- Default to system user if not provided
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    items_moved INTEGER,
    negative_balance_items INTEGER,
    results JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item RECORD;
    v_balance RECORD;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_source_location VARCHAR := 'E-Commerce';
    v_dest_location VARCHAR := 'Dispatch';
    v_warehouse VARCHAR := 'WH001';
    v_items_moved INTEGER := 0;
    v_negative_count INTEGER := 0;
    v_results JSONB := '[]'::JSONB;
    v_qty_per_pack INTEGER;
    v_remaining_qty NUMERIC;
    v_actual_sku_id VARCHAR;
    v_dispatch_balance_id BIGINT;
    v_effective_user_id BIGINT;
BEGIN
    -- Ensure we have a valid user_id (default to 1 if NULL)
    v_effective_user_id := COALESCE(p_user_id, 1);

    -- Loop through items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(sku_id VARCHAR, quantity NUMERIC)
    LOOP
        v_actual_sku_id := v_item.sku_id;
        
        -- Lookup SKU (try sku_id first, then barcode)
        SELECT sku_id, COALESCE(qty_per_pack, 1) INTO v_actual_sku_id, v_qty_per_pack
        FROM master_sku 
        WHERE sku_id = v_item.sku_id OR barcode = v_item.sku_id
        LIMIT 1;
        
        IF v_actual_sku_id IS NULL THEN
            v_actual_sku_id := v_item.sku_id;
            v_qty_per_pack := 1;
        END IF;
        
        v_remaining_qty := v_item.quantity;
        
        -- Deduct from E-Commerce balances (FEFO + FIFO) with FOR UPDATE lock
        FOR v_balance IN
            SELECT 
                balance_id, 
                pallet_id, 
                total_piece_qty,
                reserved_piece_qty,
                total_piece_qty - reserved_piece_qty as available_qty
            FROM wms_inventory_balances
            WHERE warehouse_id = v_warehouse
            AND location_id = v_source_location
            AND sku_id = v_actual_sku_id
            AND pallet_id NOT LIKE 'VIRTUAL-%'
            AND total_piece_qty > reserved_piece_qty
            ORDER BY expiry_date ASC NULLS LAST, production_date ASC NULLS LAST, created_at ASC
            FOR UPDATE SKIP LOCKED
        LOOP
            EXIT WHEN v_remaining_qty <= 0;
            
            DECLARE
                v_qty_to_move NUMERIC;
                v_pack_to_move NUMERIC;
            BEGIN
                v_qty_to_move := LEAST(v_balance.available_qty, v_remaining_qty);
                v_pack_to_move := v_qty_to_move / v_qty_per_pack;
                
                -- Deduct from source
                UPDATE wms_inventory_balances
                SET 
                    total_piece_qty = total_piece_qty - v_qty_to_move,
                    total_pack_qty = total_pack_qty - v_pack_to_move,
                    updated_at = v_now
                WHERE balance_id = v_balance.balance_id;
                
                v_remaining_qty := v_remaining_qty - v_qty_to_move;
            END;
        END LOOP;
        
        -- If not enough stock, create negative virtual balance
        IF v_remaining_qty > 0 THEN
            PERFORM create_or_update_virtual_balance(
                v_source_location,
                v_actual_sku_id,
                v_warehouse,
                -v_remaining_qty,
                -(v_remaining_qty / v_qty_per_pack),
                0, 0
            );
            v_negative_count := v_negative_count + 1;
        END IF;
        
        -- Add to Dispatch location (with lock)
        SELECT balance_id INTO v_dispatch_balance_id
        FROM wms_inventory_balances
        WHERE warehouse_id = v_warehouse
        AND location_id = v_dest_location
        AND sku_id = v_actual_sku_id
        FOR UPDATE;
        
        IF v_dispatch_balance_id IS NOT NULL THEN
            UPDATE wms_inventory_balances
            SET 
                total_piece_qty = total_piece_qty + v_item.quantity,
                total_pack_qty = total_pack_qty + (v_item.quantity / v_qty_per_pack),
                updated_at = v_now
            WHERE balance_id = v_dispatch_balance_id;
        ELSE
            INSERT INTO wms_inventory_balances (
                warehouse_id, location_id, sku_id, pallet_id,
                total_piece_qty, total_pack_qty,
                reserved_piece_qty, reserved_pack_qty,
                created_at, updated_at
            ) VALUES (
                v_warehouse, v_dest_location, v_actual_sku_id, 
                'DISPATCH-' || v_actual_sku_id,
                v_item.quantity, v_item.quantity / v_qty_per_pack,
                0, 0, v_now, v_now
            );
        END IF;
        
        -- Create ledger entries with created_by
        INSERT INTO wms_inventory_ledger (
            warehouse_id, location_id, sku_id,
            transaction_type, direction,
            piece_qty, pack_qty,
            reference_no, remarks,
            created_by, skip_balance_sync
        ) VALUES 
        (v_warehouse, v_dest_location, v_actual_sku_id, 'online_pack', 'in',
         v_item.quantity, v_item.quantity / v_qty_per_pack,
         p_order_number, format('แพ็คออนไลน์ - %s (%s)', p_order_number, p_tracking_number),
         v_effective_user_id, TRUE),
        (v_warehouse, v_source_location, v_actual_sku_id, 'online_pack', 'out',
         v_item.quantity, v_item.quantity / v_qty_per_pack,
         p_order_number, format('แพ็คออนไลน์ - %s (%s)', p_order_number, p_tracking_number),
         v_effective_user_id, TRUE);
        
        v_items_moved := v_items_moved + 1;
        v_results := v_results || jsonb_build_object(
            'sku_id', v_actual_sku_id,
            'quantity', v_item.quantity,
            'has_negative', v_remaining_qty > 0
        );
    END LOOP;
    
    RETURN QUERY SELECT 
        TRUE,
        format('Moved %s items from %s to %s', v_items_moved, v_source_location, v_dest_location)::TEXT,
        v_items_moved,
        v_negative_count,
        v_results;
END;
$$;

COMMENT ON FUNCTION atomic_online_pack_stock_move IS 
'Migration 317: Fixed to ensure created_by is always set (defaults to system user 1)';

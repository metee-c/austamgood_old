-- Migration 223: Fix process_loadlist_loading_complete_atomic to prevent duplicate face_sheet processing
--
-- Problem: When a face sheet is linked to multiple loadlists (e.g., LD-A has FS-1, LD-B has FS-1 + BFS mapped to FS-1),
-- the atomic function processes the same face_sheet_items multiple times, depleting stock incorrectly.
--
-- Root cause: The function queries face_sheet_items based on `loadlist_face_sheets` link,
-- without checking if those items were already processed (loaded) by another loadlist.
--
-- Solution: Add condition to ONLY process face_sheet_items where the corresponding
-- loadlist_face_sheets.loaded_at IS NULL (not loaded yet for THIS loadlist).
-- This ensures each face_sheet_item is processed exactly once.

CREATE OR REPLACE FUNCTION public.process_loadlist_loading_complete_atomic(
    p_loadlist_id bigint,
    p_delivery_location_id character varying,
    p_idempotency_key character varying DEFAULT NULL::character varying,
    p_locked_by character varying DEFAULT NULL::character varying
)
RETURNS TABLE(success boolean, processed_count integer, total_qty_moved numeric, error_message text, is_duplicate boolean)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_lock_key VARCHAR;
    v_lock_acquired BOOLEAN := FALSE;
    v_processed_count INTEGER := 0;
    v_total_qty_moved NUMERIC := 0;
    v_error_msg TEXT := NULL;
    v_dispatch_location_id VARCHAR;
    v_mrtd_location_id VARCHAR;
    v_pqtd_location_id VARCHAR;
    v_loadlist_code TEXT;
    v_item RECORD;
    v_staging_balance RECORD;
    v_new_balance_id BIGINT;
    v_qty_to_move NUMERIC;
    v_pack_to_move NUMERIC;
    v_idempotency_check RECORD;
    -- For online order processing
    v_online_item RECORD;
    v_actual_sku_id VARCHAR;
    v_online_qty_per_pack NUMERIC;
    v_remaining_qty NUMERIC;
BEGIN
    -- ========================================
    -- STEP 1: Check Idempotency
    -- ========================================
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_idempotency_check
        FROM check_idempotency(p_idempotency_key, 'loading_complete');

        IF v_idempotency_check.is_duplicate THEN
            RETURN QUERY SELECT
                TRUE,
                (v_idempotency_check.previous_response->>'processed_count')::INTEGER,
                (v_idempotency_check.previous_response->>'total_qty_moved')::NUMERIC,
                NULL::TEXT,
                TRUE;
            RETURN;
        END IF;
    END IF;

    -- ========================================
    -- STEP 2: Acquire Lock
    -- ========================================
    v_lock_key := 'loadlist_loading_' || p_loadlist_id;

    IF p_locked_by IS NOT NULL THEN
        v_lock_acquired := acquire_lock(v_lock_key, p_locked_by, 60);

        IF NOT v_lock_acquired THEN
            RETURN QUERY SELECT
                FALSE,
                0,
                0::NUMERIC,
                'ไม่สามารถ lock loadlist ได้ - อาจมีการ process อยู่'::TEXT,
                FALSE;
            RETURN;
        END IF;
    END IF;

    -- ========================================
    -- STEP 3: Begin Atomic Transaction
    -- ========================================
    BEGIN
        -- Get Staging location IDs
        SELECT location_id INTO v_dispatch_location_id
        FROM master_location WHERE location_code = 'Dispatch' LIMIT 1;

        SELECT location_id INTO v_mrtd_location_id
        FROM master_location WHERE location_code = 'MRTD' LIMIT 1;

        SELECT location_id INTO v_pqtd_location_id
        FROM master_location WHERE location_code = 'PQTD' LIMIT 1;

        IF v_dispatch_location_id IS NULL THEN
            RAISE EXCEPTION 'Dispatch location not found';
        END IF;

        -- Get loadlist code
        SELECT loadlist_code INTO v_loadlist_code
        FROM loadlists WHERE id = p_loadlist_id;

        IF v_loadlist_code IS NULL THEN
            RAISE EXCEPTION 'Loadlist not found: %', p_loadlist_id;
        END IF;

        -- ==========================================
        -- Process Picklist Items with Row Lock
        -- ==========================================
        FOR v_item IN (
            SELECT
                pi.id as item_id,
                pi.sku_id,
                pi.quantity_picked,
                pi.picklist_id,
                p.picklist_code,
                'WH001' as warehouse_id,
                COALESCE(ms.qty_per_pack, 1) as qty_per_pack
            FROM wms_loadlist_picklists lp
            JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
            JOIN picklists p ON p.id = pi.picklist_id
            LEFT JOIN master_sku ms ON ms.sku_id = pi.sku_id
            WHERE lp.loadlist_id = p_loadlist_id
              AND pi.status = 'picked'
              AND pi.voided_at IS NULL
              AND pi.quantity_picked > 0
            FOR UPDATE OF pi
        ) LOOP
            v_qty_to_move := v_item.quantity_picked;
            v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

            SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no
            INTO v_staging_balance
            FROM wms_inventory_balances
            WHERE warehouse_id = v_item.warehouse_id
              AND location_id = v_dispatch_location_id
              AND sku_id = v_item.sku_id
              AND total_piece_qty >= v_qty_to_move
            ORDER BY expiry_date ASC NULLS LAST, created_at ASC
            LIMIT 1
            FOR UPDATE;

            IF v_staging_balance.balance_id IS NOT NULL THEN
                UPDATE wms_inventory_balances
                SET total_piece_qty = total_piece_qty - v_qty_to_move,
                    total_pack_qty = total_pack_qty - v_pack_to_move,
                    updated_at = NOW()
                WHERE balance_id = v_staging_balance.balance_id;

                INSERT INTO wms_inventory_balances (
                    warehouse_id, location_id, sku_id, pallet_id,
                    production_date, expiry_date, lot_no,
                    total_piece_qty, total_pack_qty,
                    reserved_piece_qty, reserved_pack_qty,
                    created_at, updated_at
                ) VALUES (
                    v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
                    v_staging_balance.pallet_id,
                    v_staging_balance.production_date, v_staging_balance.expiry_date,
                    v_staging_balance.lot_no,
                    v_qty_to_move, v_pack_to_move, 0, 0, NOW(), NOW()
                )
                ON CONFLICT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date)
                DO UPDATE SET
                    total_piece_qty = wms_inventory_balances.total_piece_qty + v_qty_to_move,
                    total_pack_qty = wms_inventory_balances.total_pack_qty + v_pack_to_move,
                    updated_at = NOW();

                INSERT INTO wms_inventory_ledger (
                    transaction_type, reference_no, warehouse_id, location_id, sku_id,
                    pallet_id, production_date, expiry_date,
                    direction, piece_qty, pack_qty, remarks,
                    skip_balance_sync, created_at, reference_doc_type
                ) VALUES
                (
                    'ship', v_loadlist_code, v_item.warehouse_id, v_dispatch_location_id,
                    v_item.sku_id, v_staging_balance.pallet_id, v_staging_balance.production_date,
                    v_staging_balance.expiry_date, 'out', v_qty_to_move, v_pack_to_move,
                    'Loading complete: ' || v_item.picklist_code, true, NOW(), 'loadlist'
                ),
                (
                    'ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id,
                    v_item.sku_id, v_staging_balance.pallet_id, v_staging_balance.production_date,
                    v_staging_balance.expiry_date, 'in', v_qty_to_move, v_pack_to_move,
                    'Loading complete: ' || v_item.picklist_code, true, NOW(), 'loadlist'
                );

                UPDATE picklist_item_reservations
                SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
                WHERE picklist_item_id = v_item.item_id AND status = 'picked';

                v_processed_count := v_processed_count + 1;
                v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
            END IF;
        END LOOP;

        -- ==========================================
        -- Process Face Sheet Items (✅ FIX: Only if NOT already loaded)
        -- ==========================================
        FOR v_item IN (
            SELECT
                fsi.id as item_id,
                fsi.sku_id,
                fsi.quantity_picked,
                fs.face_sheet_no,
                'WH001' as warehouse_id,
                COALESCE(ms.qty_per_pack, 1) as qty_per_pack
            FROM loadlist_face_sheets lfs
            JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
            JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
            LEFT JOIN master_sku ms ON ms.sku_id = fsi.sku_id
            WHERE lfs.loadlist_id = p_loadlist_id
              AND lfs.loaded_at IS NULL  -- ✅ FIX: Only process if not loaded yet
              AND fsi.status = 'picked'
              AND fsi.voided_at IS NULL
              AND fsi.quantity_picked > 0
            FOR UPDATE OF fsi
        ) LOOP
            v_qty_to_move := v_item.quantity_picked;
            v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

            SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no
            INTO v_staging_balance
            FROM wms_inventory_balances
            WHERE warehouse_id = v_item.warehouse_id
              AND location_id = v_dispatch_location_id
              AND sku_id = v_item.sku_id
              AND total_piece_qty >= v_qty_to_move
            ORDER BY expiry_date ASC NULLS LAST
            LIMIT 1
            FOR UPDATE;

            IF v_staging_balance.balance_id IS NOT NULL THEN
                UPDATE wms_inventory_balances
                SET total_piece_qty = total_piece_qty - v_qty_to_move,
                    total_pack_qty = total_pack_qty - v_pack_to_move,
                    updated_at = NOW()
                WHERE balance_id = v_staging_balance.balance_id;

                INSERT INTO wms_inventory_balances (
                    warehouse_id, location_id, sku_id, pallet_id,
                    production_date, expiry_date, lot_no,
                    total_piece_qty, total_pack_qty,
                    reserved_piece_qty, reserved_pack_qty,
                    created_at, updated_at
                ) VALUES (
                    v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
                    v_staging_balance.pallet_id, v_staging_balance.production_date,
                    v_staging_balance.expiry_date, v_staging_balance.lot_no,
                    v_qty_to_move, v_pack_to_move, 0, 0, NOW(), NOW()
                )
                ON CONFLICT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date)
                DO UPDATE SET
                    total_piece_qty = wms_inventory_balances.total_piece_qty + v_qty_to_move,
                    total_pack_qty = wms_inventory_balances.total_pack_qty + v_pack_to_move,
                    updated_at = NOW();

                INSERT INTO wms_inventory_ledger (
                    transaction_type, reference_no, warehouse_id, location_id, sku_id,
                    direction, piece_qty, pack_qty, remarks, skip_balance_sync,
                    created_at, reference_doc_type
                ) VALUES
                ('ship', v_loadlist_code, v_item.warehouse_id, v_dispatch_location_id,
                 v_item.sku_id, 'out', v_qty_to_move, v_pack_to_move,
                 'Loading complete: ' || v_item.face_sheet_no, true, NOW(), 'loadlist'),
                ('ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id,
                 v_item.sku_id, 'in', v_qty_to_move, v_pack_to_move,
                 'Loading complete: ' || v_item.face_sheet_no, true, NOW(), 'loadlist');

                UPDATE face_sheet_item_reservations
                SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
                WHERE face_sheet_item_id = v_item.item_id AND status = 'picked';

                v_processed_count := v_processed_count + 1;
                v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
            END IF;
        END LOOP;

        -- ==========================================
        -- Process Bonus Face Sheet Items (✅ FIX: Only if NOT already loaded)
        -- ==========================================
        FOR v_item IN (
            SELECT
                bfsi.id as item_id,
                bfsi.sku_id,
                bfsi.quantity_picked,
                bfs.face_sheet_no,
                'WH001' as warehouse_id,
                COALESCE(ms.qty_per_pack, 1) as qty_per_pack
            FROM wms_loadlist_bonus_face_sheets lbfs
            JOIN bonus_face_sheet_items bfsi ON bfsi.face_sheet_id = lbfs.bonus_face_sheet_id
            JOIN bonus_face_sheets bfs ON bfs.id = bfsi.face_sheet_id
            LEFT JOIN master_sku ms ON ms.sku_id = bfsi.sku_id
            WHERE lbfs.loadlist_id = p_loadlist_id
              AND lbfs.loaded_at IS NULL  -- ✅ FIX: Only process if not loaded yet
              AND bfsi.status = 'picked'
              AND bfsi.voided_at IS NULL
              AND bfsi.quantity_picked > 0
            FOR UPDATE OF bfsi
        ) LOOP
            v_qty_to_move := v_item.quantity_picked;
            v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

            SELECT b.balance_id, b.total_piece_qty, b.pallet_id,
                   b.production_date, b.expiry_date, b.lot_no, b.location_id
            INTO v_staging_balance
            FROM wms_inventory_balances b
            WHERE b.warehouse_id = v_item.warehouse_id
              AND b.location_id IN (v_mrtd_location_id, v_pqtd_location_id, v_dispatch_location_id)
              AND b.sku_id = v_item.sku_id
              AND b.total_piece_qty >= v_qty_to_move
            ORDER BY
                CASE b.location_id
                    WHEN v_mrtd_location_id THEN 1
                    WHEN v_pqtd_location_id THEN 2
                    WHEN v_dispatch_location_id THEN 3
                END,
                b.expiry_date ASC NULLS LAST
            LIMIT 1
            FOR UPDATE;

            IF v_staging_balance.balance_id IS NOT NULL THEN
                UPDATE wms_inventory_balances
                SET total_piece_qty = total_piece_qty - v_qty_to_move,
                    total_pack_qty = total_pack_qty - v_pack_to_move,
                    updated_at = NOW()
                WHERE balance_id = v_staging_balance.balance_id;

                INSERT INTO wms_inventory_balances (
                    warehouse_id, location_id, sku_id, pallet_id,
                    production_date, expiry_date, lot_no,
                    total_piece_qty, total_pack_qty,
                    reserved_piece_qty, reserved_pack_qty,
                    created_at, updated_at
                ) VALUES (
                    v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
                    v_staging_balance.pallet_id, v_staging_balance.production_date,
                    v_staging_balance.expiry_date, v_staging_balance.lot_no,
                    v_qty_to_move, v_pack_to_move, 0, 0, NOW(), NOW()
                )
                ON CONFLICT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date)
                DO UPDATE SET
                    total_piece_qty = wms_inventory_balances.total_piece_qty + v_qty_to_move,
                    total_pack_qty = wms_inventory_balances.total_pack_qty + v_pack_to_move,
                    updated_at = NOW();

                INSERT INTO wms_inventory_ledger (
                    transaction_type, reference_no, warehouse_id, location_id, sku_id,
                    direction, piece_qty, pack_qty, remarks, skip_balance_sync,
                    created_at, reference_doc_type
                ) VALUES
                ('ship', v_loadlist_code, v_item.warehouse_id, v_staging_balance.location_id,
                 v_item.sku_id, 'out', v_qty_to_move, v_pack_to_move,
                 'Loading complete: ' || v_item.face_sheet_no, true, NOW(), 'loadlist'),
                ('ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id,
                 v_item.sku_id, 'in', v_qty_to_move, v_pack_to_move,
                 'Loading complete: ' || v_item.face_sheet_no, true, NOW(), 'loadlist');

                UPDATE bonus_face_sheet_item_reservations
                SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
                WHERE bonus_face_sheet_item_id = v_item.item_id AND status = 'picked';

                v_processed_count := v_processed_count + 1;
                v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
            END IF;
        END LOOP;

        -- ==========================================
        -- Process Online Order Items (packing_backup_orders)
        -- WITH BUNDLE EXPANSION from product_bundle_mappings
        -- ==========================================
        FOR v_online_item IN (
            -- Expand bundles: join with product_bundle_mappings
            -- If parent_sku is a bundle → expand to component SKUs with multiplied quantities
            -- If parent_sku is NOT a bundle → use parent_sku directly
            SELECT
                COALESCE(bm.component_sku, pbo.parent_sku) as resolved_sku,
                SUM(pbo.quantity * COALESCE(bm.component_quantity, 1)) as total_quantity
            FROM packing_backup_orders pbo
            LEFT JOIN product_bundle_mappings bm ON bm.parent_sku = pbo.parent_sku
            WHERE pbo.loadlist_id = p_loadlist_id
              AND pbo.parent_sku IS NOT NULL
              AND pbo.quantity > 0
            GROUP BY COALESCE(bm.component_sku, pbo.parent_sku)
            HAVING SUM(pbo.quantity * COALESCE(bm.component_quantity, 1)) > 0
        ) LOOP
            -- Map resolved_sku (which is barcode for bundles or parent_sku) to actual WMS sku_id
            SELECT ms.sku_id, COALESCE(ms.qty_per_pack, 1)
            INTO v_actual_sku_id, v_online_qty_per_pack
            FROM master_sku ms
            WHERE ms.barcode = v_online_item.resolved_sku
               OR ms.sku_id = v_online_item.resolved_sku
            LIMIT 1;

            -- Skip if SKU not found
            IF v_actual_sku_id IS NULL THEN
                RAISE NOTICE 'SKU not found for online order: %', v_online_item.resolved_sku;
                CONTINUE;
            END IF;

            -- Skip sticker SKUs
            IF v_actual_sku_id LIKE '%STICKER%' THEN
                CONTINUE;
            END IF;

            v_remaining_qty := v_online_item.total_quantity;

            -- Process across multiple balance rows at Dispatch (FEFO + FIFO)
            FOR v_staging_balance IN (
                SELECT balance_id, total_piece_qty, pallet_id,
                       production_date, expiry_date, lot_no
                FROM wms_inventory_balances
                WHERE warehouse_id = 'WH001'
                  AND location_id = v_dispatch_location_id
                  AND sku_id = v_actual_sku_id
                  AND total_piece_qty > 0
                ORDER BY expiry_date ASC NULLS LAST, created_at ASC
                FOR UPDATE
            ) LOOP
                EXIT WHEN v_remaining_qty <= 0;

                DECLARE
                    v_qty_from_balance NUMERIC;
                    v_pack_from_balance NUMERIC;
                BEGIN
                    v_qty_from_balance := LEAST(v_staging_balance.total_piece_qty, v_remaining_qty);
                    v_pack_from_balance := v_qty_from_balance / v_online_qty_per_pack;

                    -- Deduct from Dispatch
                    UPDATE wms_inventory_balances
                    SET total_piece_qty = total_piece_qty - v_qty_from_balance,
                        total_pack_qty = total_pack_qty - v_pack_from_balance,
                        updated_at = NOW()
                    WHERE balance_id = v_staging_balance.balance_id;

                    -- Add to Delivery-In-Progress (upsert)
                    INSERT INTO wms_inventory_balances (
                        warehouse_id, location_id, sku_id, pallet_id,
                        production_date, expiry_date, lot_no,
                        total_piece_qty, total_pack_qty,
                        reserved_piece_qty, reserved_pack_qty,
                        created_at, updated_at
                    ) VALUES (
                        'WH001', p_delivery_location_id, v_actual_sku_id,
                        v_staging_balance.pallet_id, v_staging_balance.production_date,
                        v_staging_balance.expiry_date, v_staging_balance.lot_no,
                        v_qty_from_balance, v_pack_from_balance, 0, 0, NOW(), NOW()
                    )
                    ON CONFLICT (warehouse_id, sku_id, location_id, pallet_id, production_date, expiry_date)
                    DO UPDATE SET
                        total_piece_qty = wms_inventory_balances.total_piece_qty + v_qty_from_balance,
                        total_pack_qty = wms_inventory_balances.total_pack_qty + v_pack_from_balance,
                        updated_at = NOW();

                    -- Create dual-entry ledger
                    INSERT INTO wms_inventory_ledger (
                        transaction_type, reference_no, warehouse_id, location_id, sku_id,
                        pallet_id, production_date, expiry_date,
                        direction, piece_qty, pack_qty, remarks,
                        skip_balance_sync, created_at, reference_doc_type
                    ) VALUES
                    (
                        'ship', v_loadlist_code, 'WH001', v_dispatch_location_id,
                        v_actual_sku_id, v_staging_balance.pallet_id,
                        v_staging_balance.production_date, v_staging_balance.expiry_date,
                        'out', v_qty_from_balance, v_pack_from_balance,
                        'Loading complete (online): ' || v_loadlist_code,
                        true, NOW(), 'loadlist'
                    ),
                    (
                        'ship', v_loadlist_code, 'WH001', p_delivery_location_id,
                        v_actual_sku_id, v_staging_balance.pallet_id,
                        v_staging_balance.production_date, v_staging_balance.expiry_date,
                        'in', v_qty_from_balance, v_pack_from_balance,
                        'Loading complete (online): ' || v_loadlist_code,
                        true, NOW(), 'loadlist'
                    );

                    v_remaining_qty := v_remaining_qty - v_qty_from_balance;
                    v_total_qty_moved := v_total_qty_moved + v_qty_from_balance;
                END;
            END LOOP;

            IF v_remaining_qty < v_online_item.total_quantity THEN
                v_processed_count := v_processed_count + 1;
            END IF;
        END LOOP;

        -- ==========================================
        -- Update packing_backup_orders loaded_at
        -- ==========================================
        UPDATE packing_backup_orders
        SET loaded_at = NOW(),
            updated_at = NOW()
        WHERE loadlist_id = p_loadlist_id
          AND loaded_at IS NULL;

        -- ========================================
        -- STEP 4: Save Idempotency Result
        -- ========================================
        IF p_idempotency_key IS NOT NULL THEN
            PERFORM save_idempotency_result(
                p_idempotency_key,
                'loading_complete',
                NULL,
                200,
                jsonb_build_object(
                    'processed_count', v_processed_count,
                    'total_qty_moved', v_total_qty_moved
                )
            );
        END IF;

    EXCEPTION WHEN OTHERS THEN
        v_error_msg := SQLERRM;
        RAISE NOTICE 'Error in loading complete: %', v_error_msg;

        IF v_lock_acquired AND p_locked_by IS NOT NULL THEN
            PERFORM release_lock(v_lock_key, p_locked_by);
        END IF;

        RETURN QUERY SELECT
            FALSE,
            0,
            0::NUMERIC,
            v_error_msg,
            FALSE;
        RETURN;
    END;

    -- ========================================
    -- STEP 5: Release Lock
    -- ========================================
    IF v_lock_acquired AND p_locked_by IS NOT NULL THEN
        PERFORM release_lock(v_lock_key, p_locked_by);
    END IF;

    RETURN QUERY SELECT
        TRUE,
        v_processed_count,
        v_total_qty_moved,
        v_error_msg,
        FALSE;
END;
$function$;

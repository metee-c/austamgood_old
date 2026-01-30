-- Migration: Fix Loading Complete to use Stock Balance instead of Reservations
-- Problem: Loading complete fails because it relies on reservations which may not exist
-- Solution: Query stock directly from Staging locations (Dispatch, MRTD, PQTD)

-- ============================================================
-- NEW FUNCTION: process_loadlist_loading_complete_v2
-- ============================================================
-- Key Changes:
-- 1. Query stock from Staging locations (Dispatch, MRTD, PQTD) directly
-- 2. Don't require reservations - use picklist_items/face_sheet_items directly
-- 3. Move stock from Staging → Delivery-In-Progress
-- 4. Update reservation status if exists (optional)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_loadlist_loading_complete(
  p_loadlist_id bigint, 
  p_delivery_location_id character varying
)
RETURNS TABLE(processed_count integer, total_qty_moved numeric, error_message text)
LANGUAGE plpgsql
AS $function$
DECLARE
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
BEGIN
  -- Get Staging location IDs
  SELECT location_id INTO v_dispatch_location_id
  FROM master_location WHERE location_code = 'Dispatch' LIMIT 1;

  SELECT location_id INTO v_mrtd_location_id
  FROM master_location WHERE location_code = 'MRTD' LIMIT 1;

  SELECT location_id INTO v_pqtd_location_id
  FROM master_location WHERE location_code = 'PQTD' LIMIT 1;

  IF v_dispatch_location_id IS NULL THEN
    v_error_msg := 'Dispatch location not found';
    RETURN QUERY SELECT v_processed_count, v_total_qty_moved, v_error_msg;
    RETURN;
  END IF;

  -- Get loadlist code
  SELECT loadlist_code INTO v_loadlist_code
  FROM loadlists WHERE id = p_loadlist_id;

  -- ==========================================
  -- PART 1: Process Picklist Items (PL → Dispatch)
  -- ==========================================
  -- Query picklist_items directly, not through reservations
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
  ) LOOP
    BEGIN
      v_qty_to_move := v_item.quantity_picked;
      v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

      -- Find stock at Dispatch for this SKU (FEFO)
      SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no
      INTO v_staging_balance
      FROM wms_inventory_balances
      WHERE warehouse_id = v_item.warehouse_id
        AND location_id = v_dispatch_location_id
        AND sku_id = v_item.sku_id
        AND total_piece_qty >= v_qty_to_move
      ORDER BY expiry_date ASC NULLS LAST, created_at ASC
      LIMIT 1;

      IF v_staging_balance.balance_id IS NOT NULL THEN
        -- 1. Deduct from Dispatch
        UPDATE wms_inventory_balances
        SET
          total_piece_qty = total_piece_qty - v_qty_to_move,
          total_pack_qty = total_pack_qty - v_pack_to_move,
          updated_at = NOW()
        WHERE balance_id = v_staging_balance.balance_id;

        -- 2. Add to Delivery-In-Progress (upsert)
        SELECT balance_id INTO v_new_balance_id
        FROM wms_inventory_balances
        WHERE warehouse_id = v_item.warehouse_id
          AND location_id = p_delivery_location_id
          AND sku_id = v_item.sku_id
          AND COALESCE(pallet_id, '') = COALESCE(v_staging_balance.pallet_id, '')
          AND COALESCE(production_date::TEXT, '') = COALESCE(v_staging_balance.production_date::TEXT, '')
          AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_staging_balance.expiry_date::TEXT, '')
        LIMIT 1;

        IF v_new_balance_id IS NOT NULL THEN
          UPDATE wms_inventory_balances
          SET
            total_piece_qty = total_piece_qty + v_qty_to_move,
            total_pack_qty = total_pack_qty + v_pack_to_move,
            updated_at = NOW()
          WHERE balance_id = v_new_balance_id;
        ELSE
          INSERT INTO wms_inventory_balances (
            warehouse_id, location_id, sku_id, pallet_id,
            production_date, expiry_date, lot_no,
            total_piece_qty, total_pack_qty,
            reserved_piece_qty, reserved_pack_qty,
            created_at, updated_at
          ) VALUES (
            v_item.warehouse_id, p_delivery_location_id, v_item.sku_id, v_staging_balance.pallet_id,
            v_staging_balance.production_date, v_staging_balance.expiry_date, v_staging_balance.lot_no,
            v_qty_to_move, v_pack_to_move,
            0, 0,
            NOW(), NOW()
          );
        END IF;

        -- 3. Create ledger entries
        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          pallet_id, production_date, expiry_date,
          direction, piece_qty, pack_qty, remarks,
          skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, v_dispatch_location_id, v_item.sku_id,
          v_staging_balance.pallet_id, v_staging_balance.production_date, v_staging_balance.expiry_date,
          'out', v_qty_to_move, v_pack_to_move,
          'Loading complete: ' || v_item.picklist_code,
          true, NOW(), 'loadlist'
        );

        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          pallet_id, production_date, expiry_date,
          direction, piece_qty, pack_qty, remarks,
          skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
          v_staging_balance.pallet_id, v_staging_balance.production_date, v_staging_balance.expiry_date,
          'in', v_qty_to_move, v_pack_to_move,
          'Loading complete: ' || v_item.picklist_code,
          true, NOW(), 'loadlist'
        );

        -- 4. Update reservation status if exists (optional - for backward compatibility)
        UPDATE picklist_item_reservations
        SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
        WHERE picklist_item_id = v_item.item_id
          AND status = 'picked';

        v_processed_count := v_processed_count + 1;
        v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
      ELSE
        -- Try partial move if not enough stock
        SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no
        INTO v_staging_balance
        FROM wms_inventory_balances
        WHERE warehouse_id = v_item.warehouse_id
          AND location_id = v_dispatch_location_id
          AND sku_id = v_item.sku_id
          AND total_piece_qty > 0
        ORDER BY expiry_date ASC NULLS LAST, created_at ASC
        LIMIT 1;

        IF v_staging_balance.balance_id IS NOT NULL AND v_staging_balance.total_piece_qty > 0 THEN
          -- Move what we have
          v_qty_to_move := v_staging_balance.total_piece_qty;
          v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

          UPDATE wms_inventory_balances
          SET total_piece_qty = 0, total_pack_qty = 0, updated_at = NOW()
          WHERE balance_id = v_staging_balance.balance_id;

          -- Add to Delivery-In-Progress
          SELECT balance_id INTO v_new_balance_id
          FROM wms_inventory_balances
          WHERE warehouse_id = v_item.warehouse_id
            AND location_id = p_delivery_location_id
            AND sku_id = v_item.sku_id
          LIMIT 1;

          IF v_new_balance_id IS NOT NULL THEN
            UPDATE wms_inventory_balances
            SET total_piece_qty = total_piece_qty + v_qty_to_move, total_pack_qty = total_pack_qty + v_pack_to_move, updated_at = NOW()
            WHERE balance_id = v_new_balance_id;
          ELSE
            INSERT INTO wms_inventory_balances (
              warehouse_id, location_id, sku_id, pallet_id,
              production_date, expiry_date, lot_no,
              total_piece_qty, total_pack_qty,
              reserved_piece_qty, reserved_pack_qty
            ) VALUES (
              v_item.warehouse_id, p_delivery_location_id, v_item.sku_id, v_staging_balance.pallet_id,
              v_staging_balance.production_date, v_staging_balance.expiry_date, v_staging_balance.lot_no,
              v_qty_to_move, v_pack_to_move, 0, 0
            );
          END IF;

          -- Ledger entries for partial move
          INSERT INTO wms_inventory_ledger (
            transaction_type, reference_no, warehouse_id, location_id, sku_id,
            direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
          ) VALUES (
            'ship', v_loadlist_code, v_item.warehouse_id, v_dispatch_location_id, v_item.sku_id,
            'out', v_qty_to_move, v_pack_to_move, 'Loading complete (partial): ' || v_item.picklist_code,
            true, NOW(), 'loadlist'
          );

          INSERT INTO wms_inventory_ledger (
            transaction_type, reference_no, warehouse_id, location_id, sku_id,
            direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
          ) VALUES (
            'ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
            'in', v_qty_to_move, v_pack_to_move, 'Loading complete (partial): ' || v_item.picklist_code,
            true, NOW(), 'loadlist'
          );

          v_processed_count := v_processed_count + 1;
          v_total_qty_moved := v_total_qty_moved + v_qty_to_move;

          RAISE NOTICE 'Partial move for picklist SKU %: moved % of %', v_item.sku_id, v_qty_to_move, v_item.quantity_picked;
        ELSE
          RAISE NOTICE 'No Dispatch stock for picklist SKU %', v_item.sku_id;
        END IF;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Picklist error: ' || SQLERRM;
      RAISE NOTICE 'Error processing picklist item %: %', v_item.item_id, SQLERRM;
    END;
  END LOOP;

  -- ==========================================
  -- PART 2: Process Face Sheet Items (FS → Dispatch)
  -- ==========================================
  FOR v_item IN (
    SELECT
      fsi.id as item_id,
      fsi.sku_id,
      fsi.quantity_picked,
      fsi.face_sheet_id,
      fs.face_sheet_no,
      'WH001' as warehouse_id,
      COALESCE(ms.qty_per_pack, 1) as qty_per_pack
    FROM loadlist_face_sheets lfs
    JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
    JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
    LEFT JOIN master_sku ms ON ms.sku_id = fsi.sku_id
    WHERE lfs.loadlist_id = p_loadlist_id
      AND fsi.status = 'picked'
      AND fsi.voided_at IS NULL
      AND fsi.quantity_picked > 0
  ) LOOP
    BEGIN
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
      LIMIT 1;

      IF v_staging_balance.balance_id IS NOT NULL THEN
        UPDATE wms_inventory_balances
        SET total_piece_qty = total_piece_qty - v_qty_to_move, total_pack_qty = total_pack_qty - v_pack_to_move, updated_at = NOW()
        WHERE balance_id = v_staging_balance.balance_id;

        SELECT balance_id INTO v_new_balance_id
        FROM wms_inventory_balances
        WHERE warehouse_id = v_item.warehouse_id
          AND location_id = p_delivery_location_id
          AND sku_id = v_item.sku_id
        LIMIT 1;

        IF v_new_balance_id IS NOT NULL THEN
          UPDATE wms_inventory_balances
          SET total_piece_qty = total_piece_qty + v_qty_to_move, total_pack_qty = total_pack_qty + v_pack_to_move, updated_at = NOW()
          WHERE balance_id = v_new_balance_id;
        ELSE
          INSERT INTO wms_inventory_balances (
            warehouse_id, location_id, sku_id, pallet_id,
            production_date, expiry_date, lot_no,
            total_piece_qty, total_pack_qty,
            reserved_piece_qty, reserved_pack_qty
          ) VALUES (
            v_item.warehouse_id, p_delivery_location_id, v_item.sku_id, v_staging_balance.pallet_id,
            v_staging_balance.production_date, v_staging_balance.expiry_date, v_staging_balance.lot_no,
            v_qty_to_move, v_pack_to_move, 0, 0
          );
        END IF;

        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, v_dispatch_location_id, v_item.sku_id,
          'out', v_qty_to_move, v_pack_to_move, 'Loading complete: ' || v_item.face_sheet_no,
          true, NOW(), 'loadlist'
        );

        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
          'in', v_qty_to_move, v_pack_to_move, 'Loading complete: ' || v_item.face_sheet_no,
          true, NOW(), 'loadlist'
        );

        UPDATE face_sheet_item_reservations
        SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
        WHERE face_sheet_item_id = v_item.item_id AND status = 'picked';

        v_processed_count := v_processed_count + 1;
        v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
      ELSE
        RAISE NOTICE 'No Dispatch stock for face sheet SKU %', v_item.sku_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Face sheet error: ' || SQLERRM;
    END;
  END LOOP;

  -- ==========================================
  -- PART 3: Process Bonus Face Sheet Items (BFS → MRTD/PQTD)
  -- ==========================================
  FOR v_item IN (
    SELECT
      bfsi.id as item_id,
      bfsi.sku_id,
      bfsi.quantity_picked,
      bfsi.face_sheet_id,
      bfs.face_sheet_no,
      'WH001' as warehouse_id,
      COALESCE(ms.qty_per_pack, 1) as qty_per_pack
    FROM wms_loadlist_bonus_face_sheets lbfs
    JOIN bonus_face_sheet_items bfsi ON bfsi.face_sheet_id = lbfs.bonus_face_sheet_id
    JOIN bonus_face_sheets bfs ON bfs.id = bfsi.face_sheet_id
    LEFT JOIN master_sku ms ON ms.sku_id = bfsi.sku_id
    WHERE lbfs.loadlist_id = p_loadlist_id
      AND bfsi.status = 'picked'
      AND bfsi.voided_at IS NULL
      AND bfsi.quantity_picked > 0
  ) LOOP
    BEGIN
      v_qty_to_move := v_item.quantity_picked;
      v_pack_to_move := v_qty_to_move / v_item.qty_per_pack;

      -- BFS: Check MRTD, PQTD, then Dispatch
      SELECT b.balance_id, b.total_piece_qty, b.pallet_id, b.production_date, b.expiry_date, b.lot_no, b.location_id
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
        b.expiry_date ASC NULLS LAST, b.created_at ASC
      LIMIT 1;

      IF v_staging_balance.balance_id IS NOT NULL THEN
        UPDATE wms_inventory_balances
        SET total_piece_qty = total_piece_qty - v_qty_to_move, total_pack_qty = total_pack_qty - v_pack_to_move, updated_at = NOW()
        WHERE balance_id = v_staging_balance.balance_id;

        SELECT balance_id INTO v_new_balance_id
        FROM wms_inventory_balances
        WHERE warehouse_id = v_item.warehouse_id
          AND location_id = p_delivery_location_id
          AND sku_id = v_item.sku_id
        LIMIT 1;

        IF v_new_balance_id IS NOT NULL THEN
          UPDATE wms_inventory_balances
          SET total_piece_qty = total_piece_qty + v_qty_to_move, total_pack_qty = total_pack_qty + v_pack_to_move, updated_at = NOW()
          WHERE balance_id = v_new_balance_id;
        ELSE
          INSERT INTO wms_inventory_balances (
            warehouse_id, location_id, sku_id, pallet_id,
            production_date, expiry_date, lot_no,
            total_piece_qty, total_pack_qty,
            reserved_piece_qty, reserved_pack_qty
          ) VALUES (
            v_item.warehouse_id, p_delivery_location_id, v_item.sku_id, v_staging_balance.pallet_id,
            v_staging_balance.production_date, v_staging_balance.expiry_date, v_staging_balance.lot_no,
            v_qty_to_move, v_pack_to_move, 0, 0
          );
        END IF;

        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, v_staging_balance.location_id, v_item.sku_id,
          'out', v_qty_to_move, v_pack_to_move, 'Loading complete: ' || v_item.face_sheet_no,
          true, NOW(), 'loadlist'
        );

        INSERT INTO wms_inventory_ledger (
          transaction_type, reference_no, warehouse_id, location_id, sku_id,
          direction, piece_qty, pack_qty, remarks, skip_balance_sync, created_at, reference_doc_type
        ) VALUES (
          'ship', v_loadlist_code, v_item.warehouse_id, p_delivery_location_id, v_item.sku_id,
          'in', v_qty_to_move, v_pack_to_move, 'Loading complete: ' || v_item.face_sheet_no,
          true, NOW(), 'loadlist'
        );

        UPDATE bonus_face_sheet_item_reservations
        SET status = 'loaded', loaded_at = NOW(), updated_at = NOW()
        WHERE bonus_face_sheet_item_id = v_item.item_id AND status = 'picked';

        v_processed_count := v_processed_count + 1;
        v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
      ELSE
        RAISE NOTICE 'No staging stock for bonus face sheet SKU %', v_item.sku_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Bonus face sheet error: ' || SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed_count, v_total_qty_moved, v_error_msg;
END;
$function$;

-- Add comment
COMMENT ON FUNCTION process_loadlist_loading_complete IS 
'V2: Process loading complete by querying stock from Staging locations (Dispatch, MRTD, PQTD) directly instead of relying on reservations. This fixes the issue where items without reservations were not being processed.';

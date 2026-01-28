-- Migration 302: Fix process_loadlist_loading_complete to support Face Sheets and Bonus Face Sheets
--
-- Problem: The function only processed picklist_item_reservations,
-- but loadlists can contain face_sheets and bonus_face_sheets without picklists.
-- This caused stock to NOT be moved from Dispatch to Delivery-In-Progress for face sheet loadlists.
--
-- Solution: Add support for face_sheet_item_reservations and bonus_face_sheet_item_reservations

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
  v_reservation RECORD;
  v_new_balance_id BIGINT;
  v_error_msg TEXT := NULL;
  v_dispatch_location_id VARCHAR;  -- Changed from INTEGER to VARCHAR (location_id is VARCHAR)
  v_loadlist_code TEXT;
BEGIN
  -- Get Dispatch location ID
  SELECT location_id INTO v_dispatch_location_id
  FROM master_location
  WHERE location_code = 'Dispatch'
  LIMIT 1;

  IF v_dispatch_location_id IS NULL THEN
    v_error_msg := 'Dispatch location not found';
    RETURN QUERY SELECT v_processed_count, v_total_qty_moved, v_error_msg;
    RETURN;
  END IF;

  -- Get loadlist code
  SELECT loadlist_code INTO v_loadlist_code
  FROM loadlists
  WHERE id = p_loadlist_id;

  -- ==========================================
  -- PART 1: Process Picklist Item Reservations
  -- ==========================================
  FOR v_reservation IN (
    SELECT
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty,
      pi.sku_id,
      pi.picklist_id,
      b.warehouse_id,
      b.location_id as source_location_id,
      b.pallet_id,
      b.production_date,
      b.expiry_date,
      b.lot_no,
      b.total_piece_qty,
      b.total_pack_qty,
      b.reserved_piece_qty as current_reserved_piece,
      b.reserved_pack_qty as current_reserved_pack,
      p.picklist_code,
      'picklist' as source_type
    FROM wms_loadlist_picklists lp
    JOIN picklist_items pi ON pi.picklist_id = lp.picklist_id
    JOIN picklist_item_reservations r ON r.picklist_item_id = pi.id
    JOIN wms_inventory_balances b ON b.balance_id = r.balance_id
    JOIN picklists p ON p.id = pi.picklist_id
    WHERE lp.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND r.staging_location_id = 'Dispatch'
      AND pi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    BEGIN
      -- 1. Decrement reserved quantities in source balance
      UPDATE wms_inventory_balances
      SET
        reserved_piece_qty = GREATEST(0, reserved_piece_qty - v_reservation.reserved_piece_qty),
        reserved_pack_qty = GREATEST(0, reserved_pack_qty - v_reservation.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;

      -- 2. Deduct total quantities from source balance
      UPDATE wms_inventory_balances
      SET
        total_piece_qty = GREATEST(0, total_piece_qty - v_reservation.reserved_piece_qty),
        total_pack_qty = GREATEST(0, total_pack_qty - v_reservation.reserved_pack_qty),
        updated_at = NOW()
      WHERE balance_id = v_reservation.balance_id;

      -- 3. Add to delivery location (Delivery-In-Progress)
      SELECT balance_id INTO v_new_balance_id
      FROM wms_inventory_balances
      WHERE warehouse_id = v_reservation.warehouse_id
        AND location_id = p_delivery_location_id
        AND sku_id = v_reservation.sku_id
        AND COALESCE(pallet_id, '') = COALESCE(v_reservation.pallet_id, '')
        AND COALESCE(production_date::TEXT, '') = COALESCE(v_reservation.production_date::TEXT, '')
        AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_reservation.expiry_date::TEXT, '')
        AND COALESCE(lot_no, '') = COALESCE(v_reservation.lot_no, '')
      LIMIT 1;

      IF v_new_balance_id IS NOT NULL THEN
        UPDATE wms_inventory_balances
        SET
          total_piece_qty = total_piece_qty + v_reservation.reserved_piece_qty,
          total_pack_qty = total_pack_qty + v_reservation.reserved_pack_qty,
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
          v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id, v_reservation.pallet_id,
          v_reservation.production_date, v_reservation.expiry_date, v_reservation.lot_no,
          v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
          0, 0,
          NOW(), NOW()
        )
        RETURNING balance_id INTO v_new_balance_id;
      END IF;

      -- 4. Create ledger entries
      INSERT INTO wms_inventory_ledger (
        transaction_type, reference_no, warehouse_id, location_id, sku_id,
        pallet_id, production_date, expiry_date,
        direction, piece_qty, pack_qty, remarks,
        skip_balance_sync, created_at, reference_doc_type
      ) VALUES (
        'ship', v_loadlist_code, v_reservation.warehouse_id, v_reservation.source_location_id, v_reservation.sku_id,
        v_reservation.pallet_id, v_reservation.production_date, v_reservation.expiry_date,
        'out', v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
        'Loading complete: ' || v_reservation.picklist_code,
        true, NOW(), 'loadlist'
      );

      INSERT INTO wms_inventory_ledger (
        transaction_type, reference_no, warehouse_id, location_id, sku_id,
        pallet_id, production_date, expiry_date,
        direction, piece_qty, pack_qty, remarks,
        skip_balance_sync, created_at, reference_doc_type
      ) VALUES (
        'ship', v_loadlist_code, v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id,
        v_reservation.pallet_id, v_reservation.production_date, v_reservation.expiry_date,
        'in', v_reservation.reserved_piece_qty, v_reservation.reserved_pack_qty,
        'Loading complete: ' || v_reservation.picklist_code,
        true, NOW(), 'loadlist'
      );

      -- 5. Update reservation status
      UPDATE picklist_item_reservations
      SET
        status = 'loaded',
        loaded_at = NOW(),
        updated_at = NOW()
      WHERE reservation_id = v_reservation.reservation_id;

      v_processed_count := v_processed_count + 1;
      v_total_qty_moved := v_total_qty_moved + v_reservation.reserved_piece_qty;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Picklist error: ' || SQLERRM;
      RAISE NOTICE 'Error processing picklist reservation %: %', v_reservation.reservation_id, SQLERRM;
    END;
  END LOOP;

  -- ==========================================
  -- PART 2: Process Face Sheet Item Reservations
  -- ==========================================
  FOR v_reservation IN (
    SELECT
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty,
      fsi.sku_id,
      fsi.face_sheet_id,
      fs.face_sheet_no,
      'WH001' as warehouse_id,
      'face_sheet' as source_type
    FROM loadlist_face_sheets lfs
    JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
    JOIN face_sheet_item_reservations r ON r.face_sheet_item_id = fsi.id
    JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
    WHERE lfs.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND fsi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    BEGIN
      -- For face sheets, stock was already moved to Dispatch during picking
      -- We need to move from Dispatch to Delivery-In-Progress

      -- Find Dispatch balance for this SKU
      DECLARE
        v_dispatch_balance RECORD;
        v_qty_to_move NUMERIC;
      BEGIN
        v_qty_to_move := v_reservation.reserved_piece_qty;

        -- Find available balance at Dispatch
        SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no
        INTO v_dispatch_balance
        FROM wms_inventory_balances
        WHERE warehouse_id = v_reservation.warehouse_id
          AND location_id = v_dispatch_location_id
          AND sku_id = v_reservation.sku_id
          AND total_piece_qty >= v_qty_to_move
        ORDER BY expiry_date ASC NULLS LAST, created_at ASC
        LIMIT 1;

        IF v_dispatch_balance.balance_id IS NOT NULL THEN
          -- 1. Deduct from Dispatch
          UPDATE wms_inventory_balances
          SET
            total_piece_qty = total_piece_qty - v_qty_to_move,
            updated_at = NOW()
          WHERE balance_id = v_dispatch_balance.balance_id;

          -- 2. Add to Delivery-In-Progress
          SELECT balance_id INTO v_new_balance_id
          FROM wms_inventory_balances
          WHERE warehouse_id = v_reservation.warehouse_id
            AND location_id = p_delivery_location_id
            AND sku_id = v_reservation.sku_id
            AND COALESCE(pallet_id, '') = COALESCE(v_dispatch_balance.pallet_id, '')
            AND COALESCE(production_date::TEXT, '') = COALESCE(v_dispatch_balance.production_date::TEXT, '')
            AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_dispatch_balance.expiry_date::TEXT, '')
            AND COALESCE(lot_no, '') = COALESCE(v_dispatch_balance.lot_no, '')
          LIMIT 1;

          IF v_new_balance_id IS NOT NULL THEN
            UPDATE wms_inventory_balances
            SET
              total_piece_qty = total_piece_qty + v_qty_to_move,
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
              v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id, v_dispatch_balance.pallet_id,
              v_dispatch_balance.production_date, v_dispatch_balance.expiry_date, v_dispatch_balance.lot_no,
              v_qty_to_move, 0,
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
            'ship', v_loadlist_code, v_reservation.warehouse_id, v_dispatch_location_id, v_reservation.sku_id,
            v_dispatch_balance.pallet_id, v_dispatch_balance.production_date, v_dispatch_balance.expiry_date,
            'out', v_qty_to_move, 0,
            'Loading complete: ' || v_reservation.face_sheet_no,
            true, NOW(), 'loadlist'
          );

          INSERT INTO wms_inventory_ledger (
            transaction_type, reference_no, warehouse_id, location_id, sku_id,
            pallet_id, production_date, expiry_date,
            direction, piece_qty, pack_qty, remarks,
            skip_balance_sync, created_at, reference_doc_type
          ) VALUES (
            'ship', v_loadlist_code, v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id,
            v_dispatch_balance.pallet_id, v_dispatch_balance.production_date, v_dispatch_balance.expiry_date,
            'in', v_qty_to_move, 0,
            'Loading complete: ' || v_reservation.face_sheet_no,
            true, NOW(), 'loadlist'
          );

          -- 4. Update reservation status
          UPDATE face_sheet_item_reservations
          SET
            status = 'loaded',
            loaded_at = NOW(),
            updated_at = NOW()
          WHERE reservation_id = v_reservation.reservation_id;

          v_processed_count := v_processed_count + 1;
          v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
        ELSE
          v_error_msg := COALESCE(v_error_msg || '; ', '') || 'No Dispatch stock for SKU ' || v_reservation.sku_id;
          RAISE NOTICE 'No Dispatch stock for face sheet item SKU %', v_reservation.sku_id;
        END IF;
      END;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Face sheet error: ' || SQLERRM;
      RAISE NOTICE 'Error processing face sheet reservation %: %', v_reservation.reservation_id, SQLERRM;
    END;
  END LOOP;

  -- ==========================================
  -- PART 3: Process Bonus Face Sheet Item Reservations
  -- ==========================================
  FOR v_reservation IN (
    SELECT
      r.reservation_id,
      r.balance_id,
      r.reserved_piece_qty,
      r.reserved_pack_qty,
      bfsi.sku_id,
      bfsi.face_sheet_id,
      bfs.face_sheet_no,
      'WH001' as warehouse_id,
      'bonus_face_sheet' as source_type
    FROM wms_loadlist_bonus_face_sheets lbfs
    JOIN bonus_face_sheet_items bfsi ON bfsi.face_sheet_id = lbfs.bonus_face_sheet_id
    JOIN bonus_face_sheet_item_reservations r ON r.bonus_face_sheet_item_id = bfsi.id
    JOIN bonus_face_sheets bfs ON bfs.id = bfsi.face_sheet_id
    WHERE lbfs.loadlist_id = p_loadlist_id
      AND r.status = 'picked'
      AND bfsi.voided_at IS NULL
      AND r.balance_id IS NOT NULL
  ) LOOP
    BEGIN
      DECLARE
        v_dispatch_balance RECORD;
        v_qty_to_move NUMERIC;
      BEGIN
        v_qty_to_move := v_reservation.reserved_piece_qty;

        -- Find available balance at Dispatch or staging locations (PQTD, MRTD)
        SELECT balance_id, total_piece_qty, pallet_id, production_date, expiry_date, lot_no, location_id
        INTO v_dispatch_balance
        FROM wms_inventory_balances b
        JOIN master_location ml ON ml.location_id = b.location_id
        WHERE b.warehouse_id = v_reservation.warehouse_id
          AND ml.location_code IN ('Dispatch', 'PQTD', 'MRTD')
          AND b.sku_id = v_reservation.sku_id
          AND b.total_piece_qty >= v_qty_to_move
        ORDER BY
          CASE ml.location_code
            WHEN 'Dispatch' THEN 1
            WHEN 'PQTD' THEN 2
            WHEN 'MRTD' THEN 3
          END,
          b.expiry_date ASC NULLS LAST,
          b.created_at ASC
        LIMIT 1;

        IF v_dispatch_balance.balance_id IS NOT NULL THEN
          -- 1. Deduct from source
          UPDATE wms_inventory_balances
          SET
            total_piece_qty = total_piece_qty - v_qty_to_move,
            updated_at = NOW()
          WHERE balance_id = v_dispatch_balance.balance_id;

          -- 2. Add to Delivery-In-Progress
          SELECT balance_id INTO v_new_balance_id
          FROM wms_inventory_balances
          WHERE warehouse_id = v_reservation.warehouse_id
            AND location_id = p_delivery_location_id
            AND sku_id = v_reservation.sku_id
            AND COALESCE(pallet_id, '') = COALESCE(v_dispatch_balance.pallet_id, '')
            AND COALESCE(production_date::TEXT, '') = COALESCE(v_dispatch_balance.production_date::TEXT, '')
            AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_dispatch_balance.expiry_date::TEXT, '')
            AND COALESCE(lot_no, '') = COALESCE(v_dispatch_balance.lot_no, '')
          LIMIT 1;

          IF v_new_balance_id IS NOT NULL THEN
            UPDATE wms_inventory_balances
            SET
              total_piece_qty = total_piece_qty + v_qty_to_move,
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
              v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id, v_dispatch_balance.pallet_id,
              v_dispatch_balance.production_date, v_dispatch_balance.expiry_date, v_dispatch_balance.lot_no,
              v_qty_to_move, 0,
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
            'ship', v_loadlist_code, v_reservation.warehouse_id, v_dispatch_balance.location_id, v_reservation.sku_id,
            v_dispatch_balance.pallet_id, v_dispatch_balance.production_date, v_dispatch_balance.expiry_date,
            'out', v_qty_to_move, 0,
            'Loading complete: ' || v_reservation.face_sheet_no,
            true, NOW(), 'loadlist'
          );

          INSERT INTO wms_inventory_ledger (
            transaction_type, reference_no, warehouse_id, location_id, sku_id,
            pallet_id, production_date, expiry_date,
            direction, piece_qty, pack_qty, remarks,
            skip_balance_sync, created_at, reference_doc_type
          ) VALUES (
            'ship', v_loadlist_code, v_reservation.warehouse_id, p_delivery_location_id, v_reservation.sku_id,
            v_dispatch_balance.pallet_id, v_dispatch_balance.production_date, v_dispatch_balance.expiry_date,
            'in', v_qty_to_move, 0,
            'Loading complete: ' || v_reservation.face_sheet_no,
            true, NOW(), 'loadlist'
          );

          -- 4. Update reservation status
          UPDATE bonus_face_sheet_item_reservations
          SET
            status = 'loaded',
            loaded_at = NOW(),
            updated_at = NOW()
          WHERE reservation_id = v_reservation.reservation_id;

          v_processed_count := v_processed_count + 1;
          v_total_qty_moved := v_total_qty_moved + v_qty_to_move;
        ELSE
          v_error_msg := COALESCE(v_error_msg || '; ', '') || 'No staging stock for BFS SKU ' || v_reservation.sku_id;
          RAISE NOTICE 'No staging stock for bonus face sheet item SKU %', v_reservation.sku_id;
        END IF;
      END;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := COALESCE(v_error_msg || '; ', '') || 'Bonus face sheet error: ' || SQLERRM;
      RAISE NOTICE 'Error processing bonus face sheet reservation %: %', v_reservation.reservation_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed_count, v_total_qty_moved, v_error_msg;
END;
$function$;

-- Add loaded_at column to loadlist_face_sheets if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loadlist_face_sheets' AND column_name = 'loaded_at'
  ) THEN
    ALTER TABLE loadlist_face_sheets ADD COLUMN loaded_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON FUNCTION public.process_loadlist_loading_complete(bigint, character varying) IS
'Processes loadlist loading completion - moves stock from Dispatch to Delivery-In-Progress.
Supports three document types:
1. Picklist item reservations
2. Face sheet item reservations
3. Bonus face sheet item reservations

For each reservation:
- Deducts stock from source (Dispatch or staging)
- Adds stock to Delivery-In-Progress
- Creates OUT and IN ledger entries
- Updates reservation status to "loaded"';

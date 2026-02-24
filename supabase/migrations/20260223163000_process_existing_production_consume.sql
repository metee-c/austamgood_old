-- Migration: Process existing production_consume ledger entries for PO-20260220-001
-- This is a one-time migration to retroactively apply FEFO/FIFO logic to existing ledger entries
-- that were created before the new trigger was implemented

-- Process existing ledger entries for PO-20260220-001 (GR-202602-0184)
-- Created on 2026-02-23 around 10:09:40-42

DO $$
DECLARE
  v_ledger RECORD;
  v_remaining_qty NUMERIC;
  v_balance RECORD;
  v_qty_to_deduct NUMERIC;
  v_processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting to process existing production_consume ledger entries for PO-20260220-001';

  -- Loop through the 4 ledger entries created for PO-20260220-001
  -- These specific ledger_ids: 263298, 263299, 263300, 263301
  FOR v_ledger IN
    SELECT
      ledger_id,
      warehouse_id,
      location_id,
      sku_id,
      piece_qty,
      movement_at,
      reference_doc_type,
      reference_doc_id
    FROM wms_inventory_ledger
    WHERE ledger_id IN (263298, 263299, 263300, 263301)
      AND transaction_type = 'production_consume'
      AND direction = 'out'
    ORDER BY ledger_id
  LOOP
    RAISE NOTICE 'Processing ledger_id: %, SKU: %, Qty: %',
      v_ledger.ledger_id, v_ledger.sku_id, v_ledger.piece_qty;

    v_remaining_qty := v_ledger.piece_qty;

    -- Loop through balances using FEFO/FIFO logic
    FOR v_balance IN
      SELECT
        balance_id,
        total_piece_qty,
        pallet_id,
        production_date,
        expiry_date
      FROM wms_inventory_balances
      WHERE warehouse_id = v_ledger.warehouse_id
        AND location_id = v_ledger.location_id
        AND sku_id = v_ledger.sku_id
        AND total_piece_qty > 0
      ORDER BY
        expiry_date ASC NULLS LAST,
        production_date ASC NULLS LAST,
        created_at ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      v_qty_to_deduct := LEAST(v_remaining_qty, v_balance.total_piece_qty);

      RAISE NOTICE '  Deducting % from balance_id: % (pallet: %, expiry: %)',
        v_qty_to_deduct, v_balance.balance_id, v_balance.pallet_id, v_balance.expiry_date;

      UPDATE wms_inventory_balances
      SET total_piece_qty = GREATEST(0, total_piece_qty - v_qty_to_deduct),
          last_movement_at = v_ledger.movement_at,
          updated_at = CURRENT_TIMESTAMP
      WHERE balance_id = v_balance.balance_id;

      v_remaining_qty := v_remaining_qty - v_qty_to_deduct;
    END LOOP;

    IF v_remaining_qty > 0 THEN
      RAISE WARNING 'Insufficient stock at location % for SKU %. Missing: %',
        v_ledger.location_id, v_ledger.sku_id, v_remaining_qty;
    ELSE
      v_processed_count := v_processed_count + 1;
      RAISE NOTICE '  ✓ Successfully processed ledger entry for SKU: %', v_ledger.sku_id;
    END IF;

  END LOOP;

  RAISE NOTICE 'Completed processing % ledger entries for PO-20260220-001', v_processed_count;
END $$;

-- Verify the results
SELECT
  sku_id,
  location_id,
  SUM(total_piece_qty) as total_qty,
  COUNT(*) as balance_count
FROM wms_inventory_balances
WHERE location_id = (SELECT location_id FROM master_location WHERE location_code = 'Repack' LIMIT 1)
  AND sku_id IN ('01-NET-C|FHC|010', 'OTHERS00069', 'OTHERS00076', '00-NET-C|FHC|200')
GROUP BY sku_id, location_id
ORDER BY sku_id;

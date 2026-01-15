-- Migration: Move BFS-20260107-005 stock from Dispatch to MRTD
-- Issue: BFS items incorrectly showing at Dispatch in "จัดสินค้าเสร็จ (PK,FS)" tab
-- Solution: Move stock to MRTD staging area where BFS items should be

DO $$
DECLARE
  v_affected_skus TEXT[] := ARRAY['B-BAP-C|KNP|030', 'B-BEY-D|CNL|012'];
  v_sku TEXT;
  v_balance_record RECORD;
  v_new_balance_id BIGINT;
  v_ledger_entries INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Starting BFS-20260107-005 stock relocation from Dispatch to MRTD';
  
  -- Loop through each affected SKU
  FOREACH v_sku IN ARRAY v_affected_skus
  LOOP
    RAISE NOTICE '📦 Processing SKU: %', v_sku;
    
    -- Get the Dispatch balance record
    SELECT * INTO v_balance_record
    FROM wms_inventory_balances
    WHERE sku_id = v_sku
      AND location_id = 'Dispatch'
      AND total_piece_qty > 0;
    
    IF NOT FOUND THEN
      RAISE NOTICE '⚠️  No Dispatch stock found for SKU: %', v_sku;
      CONTINUE;
    END IF;
    
    RAISE NOTICE '  Found Dispatch stock: % pieces (pallet: %)', 
      v_balance_record.total_piece_qty, v_balance_record.pallet_id;
    
    -- Check if MRTD balance already exists for this SKU
    SELECT balance_id INTO v_new_balance_id
    FROM wms_inventory_balances
    WHERE sku_id = v_sku
      AND location_id = 'MRTD'
      AND warehouse_id = v_balance_record.warehouse_id
      AND COALESCE(lot_no, '') = COALESCE(v_balance_record.lot_no, '')
      AND COALESCE(production_date::TEXT, '') = COALESCE(v_balance_record.production_date::TEXT, '')
      AND COALESCE(expiry_date::TEXT, '') = COALESCE(v_balance_record.expiry_date::TEXT, '');
    
    IF v_new_balance_id IS NOT NULL THEN
      -- Update existing MRTD balance
      RAISE NOTICE '  ✅ Updating existing MRTD balance_id: %', v_new_balance_id;
      
      UPDATE wms_inventory_balances
      SET 
        total_pack_qty = total_pack_qty + v_balance_record.total_pack_qty,
        total_piece_qty = total_piece_qty + v_balance_record.total_piece_qty,
        reserved_pack_qty = reserved_pack_qty + v_balance_record.reserved_pack_qty,
        reserved_piece_qty = reserved_piece_qty + v_balance_record.reserved_piece_qty,
        updated_at = NOW()
      WHERE balance_id = v_new_balance_id;
    ELSE
      -- Create new MRTD balance
      RAISE NOTICE '  ✅ Creating new MRTD balance';
      
      INSERT INTO wms_inventory_balances (
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        pallet_id_external,
        lot_no,
        production_date,
        expiry_date,
        total_pack_qty,
        total_piece_qty,
        reserved_pack_qty,
        reserved_piece_qty,
        last_move_id,
        last_movement_at,
        created_at,
        updated_at
      )
      VALUES (
        v_balance_record.warehouse_id,
        'MRTD',
        v_balance_record.sku_id,
        v_balance_record.pallet_id,
        v_balance_record.pallet_id_external,
        v_balance_record.lot_no,
        v_balance_record.production_date,
        v_balance_record.expiry_date,
        v_balance_record.total_pack_qty,
        v_balance_record.total_piece_qty,
        v_balance_record.reserved_pack_qty,
        v_balance_record.reserved_piece_qty,
        v_balance_record.last_move_id,
        v_balance_record.last_movement_at,
        NOW(),
        NOW()
      )
      RETURNING balance_id INTO v_new_balance_id;
    END IF;
    
    -- Create ledger entry for the move (OUT from Dispatch)
    INSERT INTO wms_inventory_ledger (
      warehouse_id,
      location_id,
      sku_id,
      pallet_id,
      pallet_id_external,
      production_date,
      expiry_date,
      transaction_type,
      direction,
      pack_qty,
      piece_qty,
      reference_doc_type,
      reference_no,
      remarks,
      skip_balance_sync,
      movement_at,
      created_at
    )
    VALUES (
      v_balance_record.warehouse_id,
      'Dispatch',
      v_balance_record.sku_id,
      v_balance_record.pallet_id,
      v_balance_record.pallet_id_external,
      v_balance_record.production_date,
      v_balance_record.expiry_date,
      'TRANSFER',
      'OUT',
      -v_balance_record.total_pack_qty,
      -v_balance_record.total_piece_qty,
      'stock_adjustment',
      'MIG-214-BFS-20260107-005',
      'Migration 214: Move BFS-20260107-005 stock from Dispatch to MRTD (OUT)',
      TRUE,
      NOW(),
      NOW()
    );
    
    v_ledger_entries := v_ledger_entries + 1;
    
    -- Create ledger entry for the move (IN to MRTD)
    INSERT INTO wms_inventory_ledger (
      warehouse_id,
      location_id,
      sku_id,
      pallet_id,
      pallet_id_external,
      production_date,
      expiry_date,
      transaction_type,
      direction,
      pack_qty,
      piece_qty,
      reference_doc_type,
      reference_no,
      remarks,
      skip_balance_sync,
      movement_at,
      created_at
    )
    VALUES (
      v_balance_record.warehouse_id,
      'MRTD',
      v_balance_record.sku_id,
      v_balance_record.pallet_id,
      v_balance_record.pallet_id_external,
      v_balance_record.production_date,
      v_balance_record.expiry_date,
      'TRANSFER',
      'IN',
      v_balance_record.total_pack_qty,
      v_balance_record.total_piece_qty,
      'stock_adjustment',
      'MIG-214-BFS-20260107-005',
      'Migration 214: Move BFS-20260107-005 stock from Dispatch to MRTD (IN)',
      TRUE,
      NOW(),
      NOW()
    );
    
    v_ledger_entries := v_ledger_entries + 1;
    
    -- Delete the Dispatch balance
    DELETE FROM wms_inventory_balances
    WHERE balance_id = v_balance_record.balance_id;
    
    RAISE NOTICE '  ✅ Moved % pieces from Dispatch to MRTD (balance_id: %)', 
      v_balance_record.total_piece_qty, v_new_balance_id;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '   - SKUs processed: %', array_length(v_affected_skus, 1);
  RAISE NOTICE '   - Ledger entries created: %', v_ledger_entries;
  RAISE NOTICE '   - BFS-20260107-005 stock now at MRTD staging area';
  
END $$;
ฺ
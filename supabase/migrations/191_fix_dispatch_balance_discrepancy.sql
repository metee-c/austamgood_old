-- Migration: Fix Dispatch balance discrepancy
-- Problem: Some balance entries at Dispatch have no corresponding ledger entries
-- Solution: Create missing ledger entries to sync with balance

-- Step 1: Create missing ledger entries for Dispatch balances that have no ledger
DO $$
DECLARE
  v_balance RECORD;
  v_ledger_net NUMERIC;
  v_discrepancy NUMERIC;
BEGIN
  FOR v_balance IN 
    SELECT 
      b.balance_id,
      b.warehouse_id,
      b.location_id,
      b.sku_id,
      b.pallet_id,
      b.total_piece_qty,
      b.production_date,
      b.expiry_date,
      b.created_at
    FROM wms_inventory_balances b
    WHERE b.location_id = 'Dispatch'
      AND b.total_piece_qty > 0
  LOOP
    -- Calculate ledger net for this specific balance
    SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END), 0)
    INTO v_ledger_net
    FROM wms_inventory_ledger
    WHERE location_id = v_balance.location_id
      AND sku_id = v_balance.sku_id
      AND (pallet_id = v_balance.pallet_id OR (pallet_id IS NULL AND v_balance.pallet_id IS NULL));
    
    v_discrepancy := v_balance.total_piece_qty - v_ledger_net;
    
    -- If there's a positive discrepancy, create an adjustment ledger entry
    IF v_discrepancy > 0.01 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        production_date,
        expiry_date,
        piece_qty,
        pack_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
      ) VALUES (
        v_balance.created_at,
        'adjustment',
        'in',
        v_balance.warehouse_id,
        v_balance.location_id,
        v_balance.sku_id,
        v_balance.pallet_id,
        v_balance.production_date,
        v_balance.expiry_date,
        v_discrepancy,
        0,
        'SYNC-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Auto-sync: Balance existed without ledger entry (migration 191)',
        true,
        NOW()
      );
      
      RAISE NOTICE 'Created adjustment ledger for % at Dispatch: +% pcs', v_balance.sku_id, v_discrepancy;
    END IF;
    
    -- If there's a negative discrepancy, create an out adjustment
    IF v_discrepancy < -0.01 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        production_date,
        expiry_date,
        piece_qty,
        pack_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
      ) VALUES (
        v_balance.created_at,
        'adjustment',
        'out',
        v_balance.warehouse_id,
        v_balance.location_id,
        v_balance.sku_id,
        v_balance.pallet_id,
        v_balance.production_date,
        v_balance.expiry_date,
        ABS(v_discrepancy),
        0,
        'SYNC-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Auto-sync: Ledger exceeded balance (migration 191)',
        true,
        NOW()
      );
      
      RAISE NOTICE 'Created adjustment ledger for % at Dispatch: -% pcs', v_balance.sku_id, ABS(v_discrepancy);
    END IF;
  END LOOP;
END $$;

-- Step 2: Do the same for PK001
DO $$
DECLARE
  v_balance RECORD;
  v_ledger_net NUMERIC;
  v_discrepancy NUMERIC;
BEGIN
  FOR v_balance IN 
    SELECT 
      b.balance_id,
      b.warehouse_id,
      b.location_id,
      b.sku_id,
      b.pallet_id,
      b.total_piece_qty,
      b.production_date,
      b.expiry_date,
      b.created_at
    FROM wms_inventory_balances b
    WHERE b.location_id = 'PK001'
      AND b.total_piece_qty > 0
  LOOP
    -- Calculate ledger net for this specific balance
    SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END), 0)
    INTO v_ledger_net
    FROM wms_inventory_ledger
    WHERE location_id = v_balance.location_id
      AND sku_id = v_balance.sku_id
      AND (pallet_id = v_balance.pallet_id OR (pallet_id IS NULL AND v_balance.pallet_id IS NULL));
    
    v_discrepancy := v_balance.total_piece_qty - v_ledger_net;
    
    -- If there's a positive discrepancy, create an adjustment ledger entry
    IF v_discrepancy > 0.01 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        production_date,
        expiry_date,
        piece_qty,
        pack_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
      ) VALUES (
        v_balance.created_at,
        'adjustment',
        'in',
        v_balance.warehouse_id,
        v_balance.location_id,
        v_balance.sku_id,
        v_balance.pallet_id,
        v_balance.production_date,
        v_balance.expiry_date,
        v_discrepancy,
        0,
        'SYNC-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Auto-sync: Balance existed without ledger entry (migration 191)',
        true,
        NOW()
      );
      
      RAISE NOTICE 'Created adjustment ledger for % at PK001: +% pcs', v_balance.sku_id, v_discrepancy;
    END IF;
    
    -- If there's a negative discrepancy, create an out adjustment
    IF v_discrepancy < -0.01 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at,
        transaction_type,
        direction,
        warehouse_id,
        location_id,
        sku_id,
        pallet_id,
        production_date,
        expiry_date,
        piece_qty,
        pack_qty,
        reference_no,
        remarks,
        skip_balance_sync,
        created_at
      ) VALUES (
        v_balance.created_at,
        'adjustment',
        'out',
        v_balance.warehouse_id,
        v_balance.location_id,
        v_balance.sku_id,
        v_balance.pallet_id,
        v_balance.production_date,
        v_balance.expiry_date,
        ABS(v_discrepancy),
        0,
        'SYNC-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Auto-sync: Ledger exceeded balance (migration 191)',
        true,
        NOW()
      );
      
      RAISE NOTICE 'Created adjustment ledger for % at PK001: -% pcs', v_balance.sku_id, ABS(v_discrepancy);
    END IF;
  END LOOP;
END $$;

-- Step 3: Verify the fix
DO $$
DECLARE
  v_dispatch_discrepancy NUMERIC;
  v_pk001_discrepancy NUMERIC;
BEGIN
  -- Check Dispatch
  SELECT COALESCE(SUM(b.total_piece_qty), 0) - COALESCE(SUM(l.net_qty), 0)
  INTO v_dispatch_discrepancy
  FROM (
    SELECT SUM(total_piece_qty) as total_piece_qty
    FROM wms_inventory_balances
    WHERE location_id = 'Dispatch'
  ) b,
  (
    SELECT SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_qty
    FROM wms_inventory_ledger
    WHERE location_id = 'Dispatch'
  ) l;
  
  -- Check PK001
  SELECT COALESCE(SUM(b.total_piece_qty), 0) - COALESCE(SUM(l.net_qty), 0)
  INTO v_pk001_discrepancy
  FROM (
    SELECT SUM(total_piece_qty) as total_piece_qty
    FROM wms_inventory_balances
    WHERE location_id = 'PK001'
  ) b,
  (
    SELECT SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_qty
    FROM wms_inventory_ledger
    WHERE location_id = 'PK001'
  ) l;
  
  RAISE NOTICE 'After sync - Dispatch discrepancy: %, PK001 discrepancy: %', v_dispatch_discrepancy, v_pk001_discrepancy;
END $$;

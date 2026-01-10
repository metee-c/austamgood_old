-- Migration: 196_fix_dispatch_balance_from_ledger.sql
-- Purpose: แก้ไข discrepancy ระหว่าง balance และ ledger
-- วิธีแก้: สร้าง sync_adjustment ledger entries เพื่อให้ ledger sum ตรงกับ balance
-- หมายเหตุ: ไม่ใช่การปรับสต็อคมัว แต่เป็นการ sync ledger ให้ตรงกับ balance ที่ถูกต้อง

-- ============================================================
-- STEP 1: Sync Dispatch location
-- ============================================================

DO $$
DECLARE
  v_sku RECORD;
  v_now TIMESTAMP := CURRENT_TIMESTAMP;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '=== Starting Dispatch Balance Sync ===';
  
  FOR v_sku IN 
    WITH ledger_summary AS (
      SELECT 
        sku_id,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as ledger_net,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_net_piece
      FROM wms_inventory_ledger
      WHERE location_id = 'Dispatch'
      GROUP BY sku_id
    ),
    balance_summary AS (
      SELECT 
        sku_id,
        SUM(total_pack_qty) as balance_total,
        SUM(total_piece_qty) as balance_total_piece
      FROM wms_inventory_balances
      WHERE location_id = 'Dispatch'
      GROUP BY sku_id
    )
    SELECT 
      COALESCE(l.sku_id, b.sku_id) as sku_id,
      COALESCE(l.ledger_net, 0) as ledger_net,
      COALESCE(l.ledger_net_piece, 0) as ledger_net_piece,
      COALESCE(b.balance_total, 0) as balance_total,
      COALESCE(b.balance_total_piece, 0) as balance_total_piece,
      COALESCE(b.balance_total, 0) - COALESCE(l.ledger_net, 0) as diff_pack,
      COALESCE(b.balance_total_piece, 0) - COALESCE(l.ledger_net_piece, 0) as diff_piece
    FROM ledger_summary l
    FULL OUTER JOIN balance_summary b ON l.sku_id = b.sku_id
    WHERE ABS(COALESCE(b.balance_total, 0) - COALESCE(l.ledger_net, 0)) > 0.01
  LOOP
    v_count := v_count + 1;
    
    IF v_sku.diff_pack > 0 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
        pack_qty, piece_qty, reference_no, reference_doc_type, remarks, created_by, skip_balance_sync
      ) VALUES (
        v_now, 'sync_adjustment', 'in', 'WH001', 'Dispatch', v_sku.sku_id,
        ABS(v_sku.diff_pack), ABS(v_sku.diff_piece), 
        'SYNC-196-' || TO_CHAR(v_now, 'YYYYMMDD'), 'migration_sync',
        'Sync ledger to match balance (migration 196)', 1, TRUE
      );
    ELSE
      INSERT INTO wms_inventory_ledger (
        movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
        pack_qty, piece_qty, reference_no, reference_doc_type, remarks, created_by, skip_balance_sync
      ) VALUES (
        v_now, 'sync_adjustment', 'out', 'WH001', 'Dispatch', v_sku.sku_id,
        ABS(v_sku.diff_pack), ABS(v_sku.diff_piece),
        'SYNC-196-' || TO_CHAR(v_now, 'YYYYMMDD'), 'migration_sync',
        'Sync ledger to match balance (migration 196)', 1, TRUE
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Completed: % SKUs synced at Dispatch ===', v_count;
END $$;

-- ============================================================
-- STEP 2: Sync other locations
-- ============================================================

DO $$
DECLARE
  v_loc RECORD;
  v_now TIMESTAMP := CURRENT_TIMESTAMP;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '=== Starting Other Locations Sync ===';
  
  FOR v_loc IN 
    WITH ledger_summary AS (
      SELECT 
        warehouse_id, location_id, sku_id,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as ledger_net,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_net_piece
      FROM wms_inventory_ledger
      WHERE location_id != 'Dispatch'
      GROUP BY warehouse_id, location_id, sku_id
    ),
    balance_summary AS (
      SELECT 
        warehouse_id, location_id, sku_id,
        SUM(total_pack_qty) as balance_total,
        SUM(total_piece_qty) as balance_total_piece
      FROM wms_inventory_balances
      WHERE location_id != 'Dispatch'
      GROUP BY warehouse_id, location_id, sku_id
    )
    SELECT 
      COALESCE(l.warehouse_id, b.warehouse_id, 'WH001') as warehouse_id,
      COALESCE(l.location_id, b.location_id) as location_id,
      COALESCE(l.sku_id, b.sku_id) as sku_id,
      COALESCE(l.ledger_net, 0) as ledger_net,
      COALESCE(l.ledger_net_piece, 0) as ledger_net_piece,
      COALESCE(b.balance_total, 0) as balance_total,
      COALESCE(b.balance_total_piece, 0) as balance_total_piece,
      COALESCE(b.balance_total, 0) - COALESCE(l.ledger_net, 0) as diff_pack,
      COALESCE(b.balance_total_piece, 0) - COALESCE(l.ledger_net_piece, 0) as diff_piece
    FROM ledger_summary l
    FULL OUTER JOIN balance_summary b 
      ON l.warehouse_id = b.warehouse_id AND l.location_id = b.location_id AND l.sku_id = b.sku_id
    WHERE ABS(COALESCE(b.balance_total, 0) - COALESCE(l.ledger_net, 0)) > 0.01
  LOOP
    v_count := v_count + 1;
    
    IF v_loc.diff_pack > 0 THEN
      INSERT INTO wms_inventory_ledger (
        movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
        pack_qty, piece_qty, reference_no, reference_doc_type, remarks, created_by, skip_balance_sync
      ) VALUES (
        v_now, 'sync_adjustment', 'in', v_loc.warehouse_id, v_loc.location_id, v_loc.sku_id,
        ABS(v_loc.diff_pack), ABS(v_loc.diff_piece),
        'SYNC-196-' || TO_CHAR(v_now, 'YYYYMMDD'), 'migration_sync',
        'Sync ledger to match balance (migration 196)', 1, TRUE
      );
    ELSE
      INSERT INTO wms_inventory_ledger (
        movement_at, transaction_type, direction, warehouse_id, location_id, sku_id,
        pack_qty, piece_qty, reference_no, reference_doc_type, remarks, created_by, skip_balance_sync
      ) VALUES (
        v_now, 'sync_adjustment', 'out', v_loc.warehouse_id, v_loc.location_id, v_loc.sku_id,
        ABS(v_loc.diff_pack), ABS(v_loc.diff_piece),
        'SYNC-196-' || TO_CHAR(v_now, 'YYYYMMDD'), 'migration_sync',
        'Sync ledger to match balance (migration 196)', 1, TRUE
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== Completed: % SKU-locations synced ===', v_count;
END $$;

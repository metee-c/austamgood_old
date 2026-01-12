-- Migration: Fix stock transfer to staging for loadlists LD-20260112-0007 to LD-20260112-0010
-- Problem: Packages have storage_location = null (moved to staging) but stock wasn't transferred
-- Solution: Transfer stock from prep areas and bulk storage to PQTD/MRTD
-- Applied: 2026-01-12

DO $$
DECLARE
  v_warehouse_id TEXT := 'WH001';
  v_now TIMESTAMP := NOW();
  v_balance_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Starting stock transfer for loadlists LD-20260112-0007 to LD-20260112-0010';

  -- =====================================================
  -- STEP 1: TRANSFERS FROM PREP AREAS TO PQTD
  -- =====================================================

  -- 1. PRE-BAG|SPB|MARKET: transfer 30 from MR02 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 30, total_pack_qty = total_pack_qty - 0.15
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr02_location_id AND sku_id = 'PRE-BAG|SPB|MARKET';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 30, total_pack_qty = total_pack_qty + 0.15
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'PRE-BAG|SPB|MARKET';
  RAISE NOTICE 'Transferred 30 PRE-BAG|SPB|MARKET: MR02 -> PQTD';

  -- 2. PRE-BOW|TILT|CAT: transfer 10 from MR03 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 10, total_pack_qty = total_pack_qty - 10
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr03_location_id AND sku_id = 'PRE-BOW|TILT|CAT';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 10, total_pack_qty = total_pack_qty + 10
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'PRE-BOW|TILT|CAT';
  RAISE NOTICE 'Transferred 10 PRE-BOW|TILT|CAT: MR03 -> PQTD';

  -- 3. PRE-CHO|BLU: transfer 4 from MR01 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 4, total_pack_qty = total_pack_qty - 0.4
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr01_location_id AND sku_id = 'PRE-CHO|BLU';
  
  INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, created_at, updated_at)
  VALUES (v_warehouse_id, v_pqtd_location_id, 'PRE-CHO|BLU', 4, 0.4, 0, 0, v_now, v_now)
  ON CONFLICT (warehouse_id, location_id, sku_id) 
  DO UPDATE SET total_piece_qty = wms_inventory_balances.total_piece_qty + 4, total_pack_qty = wms_inventory_balances.total_pack_qty + 0.4, updated_at = v_now;
  RAISE NOTICE 'Transferred 4 PRE-CHO|BLU: MR01 -> PQTD';

  -- 4. PRE-CHO|GRE: transfer 4 from MR01 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 4, total_pack_qty = total_pack_qty - 0.4
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr01_location_id AND sku_id = 'PRE-CHO|GRE';
  
  INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, created_at, updated_at)
  VALUES (v_warehouse_id, v_pqtd_location_id, 'PRE-CHO|GRE', 4, 0.4, 0, 0, v_now, v_now)
  ON CONFLICT (warehouse_id, location_id, sku_id) 
  DO UPDATE SET total_piece_qty = wms_inventory_balances.total_piece_qty + 4, total_pack_qty = wms_inventory_balances.total_pack_qty + 0.4, updated_at = v_now;
  RAISE NOTICE 'Transferred 4 PRE-CHO|GRE: MR01 -> PQTD';

  -- 5. TT-NET-C|CNT|0005: transfer 60 from MR03 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 60, total_pack_qty = total_pack_qty - 1.2
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr03_location_id AND sku_id = 'TT-NET-C|CNT|0005';
  
  INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty, created_at, updated_at)
  VALUES (v_warehouse_id, v_pqtd_location_id, 'TT-NET-C|CNT|0005', 60, 1.2, 0, 0, v_now, v_now)
  ON CONFLICT (warehouse_id, location_id, sku_id) 
  DO UPDATE SET total_piece_qty = wms_inventory_balances.total_piece_qty + 60, total_pack_qty = wms_inventory_balances.total_pack_qty + 1.2, updated_at = v_now;
  RAISE NOTICE 'Transferred 60 TT-NET-C|CNT|0005: MR03 -> PQTD';

  -- 6. TT-NET-C|FHC|0005: transfer 15 from MR02 + 50 from MR03 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 15, total_pack_qty = total_pack_qty - 0.3
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr02_location_id AND sku_id = 'TT-NET-C|FHC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 50, total_pack_qty = total_pack_qty - 1
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr03_location_id AND sku_id = 'TT-NET-C|FHC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 65, total_pack_qty = total_pack_qty + 1.3
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|FHC|0005';
  RAISE NOTICE 'Transferred 65 TT-NET-C|FHC|0005: MR02+MR03 -> PQTD';

  -- 7. TT-NET-C|FNC|0005: transfer 5 from MR02 + 60 from MR03 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 5, total_pack_qty = total_pack_qty - 0.1
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr02_location_id AND sku_id = 'TT-NET-C|FNC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 60, total_pack_qty = total_pack_qty - 1.2
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr03_location_id AND sku_id = 'TT-NET-C|FNC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 65, total_pack_qty = total_pack_qty + 1.3
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|FNC|0005';
  RAISE NOTICE 'Transferred 65 TT-NET-C|FNC|0005: MR02+MR03 -> PQTD';

  -- 8. TT-NET-C|SAL|0005: transfer 5 from MR02 + 60 from MR03 to PQTD
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 5, total_pack_qty = total_pack_qty - 0.1
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr02_location_id AND sku_id = 'TT-NET-C|SAL|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 60, total_pack_qty = total_pack_qty - 1.2
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mr03_location_id AND sku_id = 'TT-NET-C|SAL|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 65, total_pack_qty = total_pack_qty + 1.3
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|SAL|0005';
  RAISE NOTICE 'Transferred 65 TT-NET-C|SAL|0005: MR02+MR03 -> PQTD';

  -- =====================================================
  -- STEP 2: TRANSFERS FROM BULK STORAGE TO COVER SHORTAGES
  -- =====================================================

  -- PRE-CHO|BLU: need 6 more at PQTD (from MCF-AA06)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 6, total_pack_qty = total_pack_qty - 0.6
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mcf_aa06_id AND sku_id = 'PRE-CHO|BLU';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 6, total_pack_qty = total_pack_qty + 0.6
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'PRE-CHO|BLU';
  RAISE NOTICE 'Transferred 6 PRE-CHO|BLU: MCF-AA06 -> PQTD';

  -- PRE-CHO|GRE: need 6 more at PQTD (from MCF-AA07)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 6, total_pack_qty = total_pack_qty - 0.6
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mcf_aa07_id AND sku_id = 'PRE-CHO|GRE';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 6, total_pack_qty = total_pack_qty + 0.6
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'PRE-CHO|GRE';
  RAISE NOTICE 'Transferred 6 PRE-CHO|GRE: MCF-AA07 -> PQTD';

  -- TT-NET-C|CNT|0005: need 140 at PQTD + 100 at MRTD (from A10-02-007)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 240, total_pack_qty = total_pack_qty - 4.8
  WHERE warehouse_id = v_warehouse_id AND location_id = v_a10_02_007_id AND sku_id = 'TT-NET-C|CNT|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 140, total_pack_qty = total_pack_qty + 2.8
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|CNT|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 100, total_pack_qty = total_pack_qty + 2
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mrtd_location_id AND sku_id = 'TT-NET-C|CNT|0005';
  RAISE NOTICE 'Transferred 140 TT-NET-C|CNT|0005: A10-02-007 -> PQTD';
  RAISE NOTICE 'Transferred 100 TT-NET-C|CNT|0005: A10-02-007 -> MRTD';

  -- TT-NET-C|FHC|0005: need 85 at PQTD + 50 at MRTD (from A08-01-024)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 135, total_pack_qty = total_pack_qty - 2.7
  WHERE warehouse_id = v_warehouse_id AND location_id = v_a08_01_024_id AND sku_id = 'TT-NET-C|FHC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 85, total_pack_qty = total_pack_qty + 1.7
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|FHC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 50, total_pack_qty = total_pack_qty + 1
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mrtd_location_id AND sku_id = 'TT-NET-C|FHC|0005';
  RAISE NOTICE 'Transferred 85 TT-NET-C|FHC|0005: A08-01-024 -> PQTD';
  RAISE NOTICE 'Transferred 50 TT-NET-C|FHC|0005: A08-01-024 -> MRTD';

  -- TT-NET-C|FNC|0005: need 65 at PQTD + 80 at MRTD (from A08-01-023)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 145, total_pack_qty = total_pack_qty - 2.9
  WHERE warehouse_id = v_warehouse_id AND location_id = v_a08_01_023_id AND sku_id = 'TT-NET-C|FNC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 65, total_pack_qty = total_pack_qty + 1.3
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|FNC|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 80, total_pack_qty = total_pack_qty + 1.6
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mrtd_location_id AND sku_id = 'TT-NET-C|FNC|0005';
  RAISE NOTICE 'Transferred 65 TT-NET-C|FNC|0005: A08-01-023 -> PQTD';
  RAISE NOTICE 'Transferred 80 TT-NET-C|FNC|0005: A08-01-023 -> MRTD';

  -- TT-NET-C|SAL|0005: need 55 at PQTD + 90 at MRTD (from A08-01-020)
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty - 145, total_pack_qty = total_pack_qty - 2.9
  WHERE warehouse_id = v_warehouse_id AND location_id = v_a08_01_020_id AND sku_id = 'TT-NET-C|SAL|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 55, total_pack_qty = total_pack_qty + 1.1
  WHERE warehouse_id = v_warehouse_id AND location_id = v_pqtd_location_id AND sku_id = 'TT-NET-C|SAL|0005';
  
  UPDATE wms_inventory_balances 
  SET total_piece_qty = total_piece_qty + 90, total_pack_qty = total_pack_qty + 1.8
  WHERE warehouse_id = v_warehouse_id AND location_id = v_mrtd_location_id AND sku_id = 'TT-NET-C|SAL|0005';
  RAISE NOTICE 'Transferred 55 TT-NET-C|SAL|0005: A08-01-020 -> PQTD';
  RAISE NOTICE 'Transferred 90 TT-NET-C|SAL|0005: A08-01-020 -> MRTD';

  RAISE NOTICE '=== Migration completed successfully ===';
END $$;

-- Migration: Add stock to Dispatch and MRTD for remaining pending loadlists
-- Date: 2026-01-18
-- Purpose: เพิ่มสต็อคให้พอสำหรับโหลดใบที่รอโหลดที่เหลืออีก 22 ใบ (หลังจาก migration 231)

-- =====================================================
-- PART 1: เพิ่มสต็อคที่ Dispatch สำหรับ Picklist Items
-- =====================================================

DO $$
DECLARE
  v_dispatch_location_id VARCHAR;
  v_mrtd_location_id VARCHAR;
BEGIN
  -- Get location IDs
  SELECT location_id INTO v_dispatch_location_id FROM master_location WHERE location_code = 'Dispatch';
  SELECT location_id INTO v_mrtd_location_id FROM master_location WHERE location_code = 'MRTD';

  -- Update existing records at Dispatch (44 SKUs)
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = ib.total_piece_qty + data.stock_to_add,
    total_pack_qty = (ib.total_piece_qty + data.stock_to_add) / COALESCE(ms.qty_per_pack, 1)
  FROM (VALUES
    ('B-BAP-C|HNS|010', 120.0),
    ('B-BAP-C|HNS|030', 159.0),
    ('B-BAP-C|IND|010', 186.0),
    ('B-BAP-C|IND|030', 36.0),
    ('B-BAP-C|KNP|010', 6.0),
    ('B-BAP-C|KNP|030', 21.0),
    ('B-BAP-C|WEP|010', 144.0),
    ('B-BAP-C|WEP|030', 24.0),
    ('B-BEY-C|LAM|010', 210.0),
    ('B-BEY-C|LAM|070', 9.0),
    ('B-BEY-C|LAM|NS|010', 54.0),
    ('B-BEY-C|MCK|010', 54.0),
    ('B-BEY-C|MCK|070', 26.0),
    ('B-BEY-C|MCK|NS|010', 42.0),
    ('B-BEY-C|MNB|010', 906.0),
    ('B-BEY-C|MNB|NS|010', 126.0),
    ('B-BEY-C|SAL|010', 924.0),
    ('B-BEY-C|SAL|NS|010', 127.0),
    ('B-BEY-C|TUN|010', 162.0),
    ('B-BEY-D|BEF|012', 162.0),
    ('B-BEY-D|BEF|100', 57.0),
    ('B-BEY-D|BEF|NS|012', 12.0),
    ('B-BEY-D|CNL|012', 54.0),
    ('B-BEY-D|CNL|100', 36.0),
    ('B-BEY-D|CNL|NS|012', 30.0),
    ('B-BEY-D|LAM|012', 36.0),
    ('B-BEY-D|LAM|100', 58.0),
    ('B-BEY-D|LAM|NS|012', 54.0),
    ('B-BEY-D|MNB|010', 108.0),
    ('B-BEY-D|MNB|NS|010', 18.0),
    ('B-BEY-D|SAL|012', 156.0),
    ('B-BEY-D|SAL|100', 88.0),
    ('B-BEY-D|SAL|NS|012', 66.0),
    ('B-NET-C|CNT|010', 300.0),
    ('B-NET-C|FHC|010', 391.0),
    ('B-NET-C|FHC|040', 40.0),
    ('B-NET-C|FNC|010', 558.0),
    ('B-NET-C|FNC|040', 76.0),
    ('B-NET-C|SAL|010', 270.0),
    ('B-NET-D|CHI-S|008', 6.0),
    ('B-NET-D|CHI-S|025', 21.0),
    ('B-NET-D|SAL-L|008', 6.0),
    ('B-NET-D|SAL-S|008', 12.0),
    ('B-NET-D|SAL-S|025', 3.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE ib.warehouse_id = 'WH001'
    AND ib.location_id = v_dispatch_location_id
    AND ib.sku_id = data.sku_id
    AND ib.pallet_id IS NULL;

  -- Insert new records for SKUs that don't exist at Dispatch
  INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    total_piece_qty,
    total_pack_qty,
    production_date,
    expiry_date
  )
  SELECT 
    'WH001',
    v_dispatch_location_id,
    data.sku_id,
    data.stock_to_add,
    data.stock_to_add / COALESCE(ms.qty_per_pack, 1),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '18 months'
  FROM (VALUES
    ('B-BAP-C|HNS|010', 120.0),
    ('B-BAP-C|HNS|030', 159.0),
    ('B-BAP-C|IND|010', 186.0),
    ('B-BAP-C|IND|030', 36.0),
    ('B-BAP-C|KNP|010', 6.0),
    ('B-BAP-C|KNP|030', 21.0),
    ('B-BAP-C|WEP|010', 144.0),
    ('B-BAP-C|WEP|030', 24.0),
    ('B-BEY-C|LAM|010', 210.0),
    ('B-BEY-C|LAM|070', 9.0),
    ('B-BEY-C|LAM|NS|010', 54.0),
    ('B-BEY-C|MCK|010', 54.0),
    ('B-BEY-C|MCK|070', 26.0),
    ('B-BEY-C|MCK|NS|010', 42.0),
    ('B-BEY-C|MNB|010', 906.0),
    ('B-BEY-C|MNB|NS|010', 126.0),
    ('B-BEY-C|SAL|010', 924.0),
    ('B-BEY-C|SAL|NS|010', 127.0),
    ('B-BEY-C|TUN|010', 162.0),
    ('B-BEY-D|BEF|012', 162.0),
    ('B-BEY-D|BEF|100', 57.0),
    ('B-BEY-D|BEF|NS|012', 12.0),
    ('B-BEY-D|CNL|012', 54.0),
    ('B-BEY-D|CNL|100', 36.0),
    ('B-BEY-D|CNL|NS|012', 30.0),
    ('B-BEY-D|LAM|012', 36.0),
    ('B-BEY-D|LAM|100', 58.0),
    ('B-BEY-D|LAM|NS|012', 54.0),
    ('B-BEY-D|MNB|010', 108.0),
    ('B-BEY-D|MNB|NS|010', 18.0),
    ('B-BEY-D|SAL|012', 156.0),
    ('B-BEY-D|SAL|100', 88.0),
    ('B-BEY-D|SAL|NS|012', 66.0),
    ('B-NET-C|CNT|010', 300.0),
    ('B-NET-C|FHC|010', 391.0),
    ('B-NET-C|FHC|040', 40.0),
    ('B-NET-C|FNC|010', 558.0),
    ('B-NET-C|FNC|040', 76.0),
    ('B-NET-C|SAL|010', 270.0),
    ('B-NET-D|CHI-S|008', 6.0),
    ('B-NET-D|CHI-S|025', 21.0),
    ('B-NET-D|SAL-L|008', 6.0),
    ('B-NET-D|SAL-S|008', 12.0),
    ('B-NET-D|SAL-S|025', 3.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances
    WHERE warehouse_id = 'WH001'
      AND location_id = v_dispatch_location_id
      AND sku_id = data.sku_id
      AND pallet_id IS NULL
  );

  RAISE NOTICE 'Added stock to Dispatch for picklist items (44 SKUs)';

  -- =====================================================
  -- PART 2: เพิ่มสต็อคที่ MRTD สำหรับ BFS Items
  -- =====================================================

  -- Update existing records at MRTD (36 SKUs)
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = ib.total_piece_qty + data.stock_to_add,
    total_pack_qty = (ib.total_piece_qty + data.stock_to_add) / COALESCE(ms.qty_per_pack, 1)
  FROM (VALUES
    ('B-BEY-C|MCK|NS|010', 620.0),
    ('B-BEY-C|MNB|NS|010', 112.0),
    ('B-BEY-D|LAM|NS|012', 132.0),
    ('B-BEY-D|MNB|NS|010', 22.0),
    ('B-NET-C|CNT|010', 50.0),
    ('B-NET-C|CNT|040', 2.0),
    ('B-NET-C|FHC|010', 30.0),
    ('B-NET-C|FNC|010', 98.0),
    ('B-NET-C|FNC|040', 2.0),
    ('B-NET-C|SAL|010', 16.0),
    ('PRE-BAG|SPB|MARKET', 3070.0),
    ('PRE-BKT|B', 4.0),
    ('PRE-BOW|TILT|CAT', 465.0),
    ('PRE-CHO|BLU', 115.0),
    ('PRE-CHO|GRE', 58.0),
    ('TT-BAP-C|HNS|0005', 1680.0),
    ('TT-BAP-C|IND|0005', 1205.0),
    ('TT-BAP-C|KNP|0005', 930.0),
    ('TT-BAP-C|WEP|0005', 2445.0),
    ('TT-BEY-C|LAM|0005', 100.0),
    ('TT-BEY-C|MCK|0005', 775.0),
    ('TT-BEY-C|MNB|0005', 260.0),
    ('TT-BEY-C|SAL|0005', 300.0),
    ('TT-BEY-C|TUN|0005', 40.0),
    ('TT-BEY-D|BEF|0005', 995.0),
    ('TT-BEY-D|CNL|0005', 155.0),
    ('TT-BEY-D|LAM|0005', 140.0),
    ('TT-BEY-D|MNB|0005', 225.0),
    ('TT-BEY-D|SAL|0005', 20.0),
    ('TT-NET-C|CNT|0005', 1585.0),
    ('TT-NET-C|FHC|0005', 110.0),
    ('TT-NET-C|FNC|0005', 5355.0),
    ('TT-NET-C|SAL|0005', 6035.0),
    ('TT-NET-D|CHI-L|0005', 945.0),
    ('TT-NET-D|SAL-L|0005', 190.0),
    ('TT-NET-D|SAL-S|0005', 200.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE ib.warehouse_id = 'WH001'
    AND ib.location_id = v_mrtd_location_id
    AND ib.sku_id = data.sku_id
    AND ib.pallet_id IS NULL;

  -- Insert new records for SKUs that don't exist at MRTD
  INSERT INTO wms_inventory_balances (
    warehouse_id,
    location_id,
    sku_id,
    total_piece_qty,
    total_pack_qty,
    production_date,
    expiry_date
  )
  SELECT 
    'WH001',
    v_mrtd_location_id,
    data.sku_id,
    data.stock_to_add,
    data.stock_to_add / COALESCE(ms.qty_per_pack, 1),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '18 months'
  FROM (VALUES
    ('B-BEY-C|MCK|NS|010', 620.0),
    ('B-BEY-C|MNB|NS|010', 112.0),
    ('B-BEY-D|LAM|NS|012', 132.0),
    ('B-BEY-D|MNB|NS|010', 22.0),
    ('B-NET-C|CNT|010', 50.0),
    ('B-NET-C|CNT|040', 2.0),
    ('B-NET-C|FHC|010', 30.0),
    ('B-NET-C|FNC|010', 98.0),
    ('B-NET-C|FNC|040', 2.0),
    ('B-NET-C|SAL|010', 16.0),
    ('PRE-BAG|SPB|MARKET', 3070.0),
    ('PRE-BKT|B', 4.0),
    ('PRE-BOW|TILT|CAT', 465.0),
    ('PRE-CHO|BLU', 115.0),
    ('PRE-CHO|GRE', 58.0),
    ('TT-BAP-C|HNS|0005', 1680.0),
    ('TT-BAP-C|IND|0005', 1205.0),
    ('TT-BAP-C|KNP|0005', 930.0),
    ('TT-BAP-C|WEP|0005', 2445.0),
    ('TT-BEY-C|LAM|0005', 100.0),
    ('TT-BEY-C|MCK|0005', 775.0),
    ('TT-BEY-C|MNB|0005', 260.0),
    ('TT-BEY-C|SAL|0005', 300.0),
    ('TT-BEY-C|TUN|0005', 40.0),
    ('TT-BEY-D|BEF|0005', 995.0),
    ('TT-BEY-D|CNL|0005', 155.0),
    ('TT-BEY-D|LAM|0005', 140.0),
    ('TT-BEY-D|MNB|0005', 225.0),
    ('TT-BEY-D|SAL|0005', 20.0),
    ('TT-NET-C|CNT|0005', 1585.0),
    ('TT-NET-C|FHC|0005', 110.0),
    ('TT-NET-C|FNC|0005', 5355.0),
    ('TT-NET-C|SAL|0005', 6035.0),
    ('TT-NET-D|CHI-L|0005', 945.0),
    ('TT-NET-D|SAL-L|0005', 190.0),
    ('TT-NET-D|SAL-S|0005', 200.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances
    WHERE warehouse_id = 'WH001'
      AND location_id = v_mrtd_location_id
      AND sku_id = data.sku_id
      AND pallet_id IS NULL
  );

  RAISE NOTICE 'Added stock to MRTD for BFS items (36 SKUs)';

END $$;

-- Summary
SELECT 
  'Migration 232 Summary' as description,
  'Dispatch' as location,
  44 as sku_count,
  5829.0 as total_pieces_added
UNION ALL
SELECT 
  'Migration 232 Summary',
  'MRTD',
  36,
  28897.0;

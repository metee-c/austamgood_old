-- Migration: Add stock to Dispatch and MRTD for pending loadlists
-- Date: 2026-01-18
-- Purpose: เพิ่มสต็อคให้พอสำหรับโหลดใบที่รอโหลดทั้งหมด โดยไม่ลดยอดจากที่ไหน

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

  -- Update existing records at Dispatch
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = ib.total_piece_qty + data.stock_to_add,
    total_pack_qty = (ib.total_piece_qty + data.stock_to_add) / COALESCE(ms.qty_per_pack, 1)
  FROM (VALUES
    ('02-STICKER-C|FNC|249', 62.0),
    ('02-STICKER-C|FNC|890', 7.0),
    ('02-STICKER-C|SAL|279', 2.0),
    ('02-STICKER-C|SAL|990', 76.0),
    ('B-BEY-C|LAM|NS|010', 42.0),
    ('B-BEY-C|MCK|NS|010', 42.0),
    ('B-BEY-C|SAL|NS|010', 173.0),
    ('B-BEY-C|TUN|NS|010', 42.0),
    ('B-BEY-D|CNL|012', 12.0),
    ('B-BEY-D|LAM|100', 7.0),
    ('B-BEY-D|MNB|NS|010', 6.0),
    ('B-NET-C|CNT|010', 12.0),
    ('B-NET-C|FHC|010', 17.0),
    ('B-NET-D|CHI-S|025', 12.0),
    ('B-NET-D|SAL-L|025', 12.0)
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
    ('02-STICKER-C|FNC|249', 62.0),
    ('02-STICKER-C|FNC|890', 7.0),
    ('02-STICKER-C|SAL|279', 2.0),
    ('02-STICKER-C|SAL|990', 76.0),
    ('B-BEY-C|LAM|NS|010', 42.0),
    ('B-BEY-C|MCK|NS|010', 42.0),
    ('B-BEY-C|SAL|NS|010', 173.0),
    ('B-BEY-C|TUN|NS|010', 42.0),
    ('B-BEY-D|CNL|012', 12.0),
    ('B-BEY-D|LAM|100', 7.0),
    ('B-BEY-D|MNB|NS|010', 6.0),
    ('B-NET-C|CNT|010', 12.0),
    ('B-NET-C|FHC|010', 17.0),
    ('B-NET-D|CHI-S|025', 12.0),
    ('B-NET-D|SAL-L|025', 12.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances
    WHERE warehouse_id = 'WH001'
      AND location_id = v_dispatch_location_id
      AND sku_id = data.sku_id
      AND pallet_id IS NULL
  );

  RAISE NOTICE 'Added stock to Dispatch for picklist items';

  -- =====================================================
  -- PART 2: เพิ่มสต็อคที่ MRTD สำหรับ BFS Items
  -- =====================================================

  -- Update existing records at MRTD
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = ib.total_piece_qty + data.stock_to_add,
    total_pack_qty = (ib.total_piece_qty + data.stock_to_add) / COALESCE(ms.qty_per_pack, 1)
  FROM (VALUES
    ('B-BEY-C|LAM|070', 2.0),
    ('B-BEY-C|SAL|NS|010', 1.0),
    ('B-BEY-C|TUN|010', 1.0),
    ('B-BEY-D|BEF|012', 1.0),
    ('B-BEY-D|CNL|100', 2.0),
    ('B-BEY-D|SAL|NS|012', 1.0),
    ('B-NET-C|FHC|040', 24.0),
    ('B-NET-C|FNC|010', 6.0),
    ('B-NET-C|FNC|040', 1.0),
    ('PRE-BAG|CAV-PROTEINX', 10.0),
    ('PRE-BAG|SPB|MARKET', 3610.0),
    ('PRE-BIB-BLUE-L', 5.0),
    ('PRE-BIB-BLUE-M', 5.0),
    ('PRE-BOW|TILT|CAT', 561.0),
    ('PRE-CHO|BLU', 8.0),
    ('PRE-CHO|GRE', 19.0),
    ('PRE-PWD|L', 10.0),
    ('TT-BAP-C|HNS|0005', 400.0),
    ('TT-BAP-C|IND|0005', 25.0),
    ('TT-BAP-C|WEP|0005', 495.0),
    ('TT-BEY-C|MCK|0005', 205.0),
    ('TT-BEY-C|MNB|0005', 70.0),
    ('TT-BEY-C|SAL|0005', 60.0),
    ('TT-BEY-C|TUN|0005', 80.0),
    ('TT-BEY-D|BEF|0005', 155.0),
    ('TT-BEY-D|CNL|0005', 75.0),
    ('TT-BEY-D|MNB|0005', 105.0),
    ('TT-BEY-D|SAL|0005', 10.0),
    ('TT-NET-C|CNT|0005', 1845.0),
    ('TT-NET-C|FHC|0005', 1835.0),
    ('TT-NET-C|FNC|0005', 2495.0),
    ('TT-NET-C|SAL|0005', 2275.0),
    ('TT-NET-D|CHI-L|0005', 315.0),
    ('TT-NET-D|CHI-S|0005', 630.0),
    ('TT-NET-D|SAL-L|0005', 50.0)
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
    ('B-BEY-C|LAM|070', 2.0),
    ('B-BEY-C|SAL|NS|010', 1.0),
    ('B-BEY-C|TUN|010', 1.0),
    ('B-BEY-D|BEF|012', 1.0),
    ('B-BEY-D|CNL|100', 2.0),
    ('B-BEY-D|SAL|NS|012', 1.0),
    ('B-NET-C|FHC|040', 24.0),
    ('B-NET-C|FNC|010', 6.0),
    ('B-NET-C|FNC|040', 1.0),
    ('PRE-BAG|CAV-PROTEINX', 10.0),
    ('PRE-BAG|SPB|MARKET', 3610.0),
    ('PRE-BIB-BLUE-L', 5.0),
    ('PRE-BIB-BLUE-M', 5.0),
    ('PRE-BOW|TILT|CAT', 561.0),
    ('PRE-CHO|BLU', 8.0),
    ('PRE-CHO|GRE', 19.0),
    ('PRE-PWD|L', 10.0),
    ('TT-BAP-C|HNS|0005', 400.0),
    ('TT-BAP-C|IND|0005', 25.0),
    ('TT-BAP-C|WEP|0005', 495.0),
    ('TT-BEY-C|MCK|0005', 205.0),
    ('TT-BEY-C|MNB|0005', 70.0),
    ('TT-BEY-C|SAL|0005', 60.0),
    ('TT-BEY-C|TUN|0005', 80.0),
    ('TT-BEY-D|BEF|0005', 155.0),
    ('TT-BEY-D|CNL|0005', 75.0),
    ('TT-BEY-D|MNB|0005', 105.0),
    ('TT-BEY-D|SAL|0005', 10.0),
    ('TT-NET-C|CNT|0005', 1845.0),
    ('TT-NET-C|FHC|0005', 1835.0),
    ('TT-NET-C|FNC|0005', 2495.0),
    ('TT-NET-C|SAL|0005', 2275.0),
    ('TT-NET-D|CHI-L|0005', 315.0),
    ('TT-NET-D|CHI-S|0005', 630.0),
    ('TT-NET-D|SAL-L|0005', 50.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances
    WHERE warehouse_id = 'WH001'
      AND location_id = v_mrtd_location_id
      AND sku_id = data.sku_id
      AND pallet_id IS NULL
  );

  RAISE NOTICE 'Added stock to MRTD for BFS items';

END $$;

-- Summary
SELECT 
  'Dispatch' as location,
  COUNT(*) as sku_count,
  SUM(total_piece_qty) as total_pieces
FROM wms_inventory_balances ib
JOIN master_location ml ON ib.location_id = ml.location_id
WHERE ml.location_code = 'Dispatch'
  AND ib.pallet_id IS NULL

UNION ALL

SELECT 
  'MRTD' as location,
  COUNT(*) as sku_count,
  SUM(total_piece_qty) as total_pieces
FROM wms_inventory_balances ib
JOIN master_location ml ON ib.location_id = ml.location_id
WHERE ml.location_code = 'MRTD'
  AND ib.pallet_id IS NULL;

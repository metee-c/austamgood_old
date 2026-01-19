-- Migration: Add missing stock to Dispatch for final pending loadlists
-- Date: 2026-01-18
-- Purpose: เพิ่มสต็อคที่ขาดหายไปสำหรับ SKUs ที่ไม่ได้รวมใน migration 232

DO $$
DECLARE
  v_dispatch_location_id VARCHAR;
BEGIN
  -- Get Dispatch location ID
  SELECT location_id INTO v_dispatch_location_id FROM master_location WHERE location_code = 'Dispatch';

  -- Update existing records at Dispatch
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = ib.total_piece_qty + data.stock_to_add,
    total_pack_qty = (ib.total_piece_qty + data.stock_to_add) / COALESCE(ms.qty_per_pack, 1)
  FROM (VALUES
    ('B-BEY-C|TUN|NS|010', 18.0),
    ('B-NET-D|CHI-L|025', 6.0),
    ('B-NET-D|SAL-L|025', 6.0),
    ('B-NET-D|SAL-L|100', 1.0)
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
    ('B-BEY-C|TUN|NS|010', 18.0),
    ('B-NET-D|CHI-L|025', 6.0),
    ('B-NET-D|SAL-L|025', 6.0),
    ('B-NET-D|SAL-L|100', 1.0)
  ) AS data(sku_id, stock_to_add)
  JOIN master_sku ms ON data.sku_id = ms.sku_id
  WHERE NOT EXISTS (
    SELECT 1 FROM wms_inventory_balances
    WHERE warehouse_id = 'WH001'
      AND location_id = v_dispatch_location_id
      AND sku_id = data.sku_id
      AND pallet_id IS NULL
  );

  RAISE NOTICE 'Added missing stock to Dispatch (4 SKUs, 31 pieces)';

END $$;

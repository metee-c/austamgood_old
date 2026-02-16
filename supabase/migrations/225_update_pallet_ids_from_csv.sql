-- ============================================
-- Migration: อัปเดต pallet_id ให้ตรงกับข้อมูล CSV
-- Reason: pallet_id ที่ถูกย้ายกลับมาไม่ตรงกับพาเลทจริงในคลัง
-- ============================================

DO $$
DECLARE
  v_balance_record RECORD;
  v_update_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📦 Updating pallet_id to match CSV data...';

  -- ============================================
  -- 1. PRE-BAG|CAV|CM|R at MCF-AB02
  -- ============================================
  -- ตามข้อมูล CSV มีพาเลท: ATG2500017272, 71, 70, 69, 68, 66, 65

  -- ลบ balance เก่าที่ไม่มี pallet_id ถูกต้อง
  DELETE FROM wms_inventory_balances
  WHERE sku_id = 'PRE-BAG|CAV|CM|R'
    AND location_id = 'MCF-AB02'
    AND (pallet_id_external IS NULL OR pallet_id_external NOT IN (
      'ATG2500017272', 'ATG2500017271', 'ATG2500017270',
      'ATG2500017269', 'ATG2500017268', 'ATG2500017266', 'ATG2500017265'
    ));

  -- สร้าง balance ใหม่ตาม CSV (7 พาเลท x 20 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    production_date, expiry_date, lot_no,
    created_at, updated_at
  )
  SELECT
    'WH001',
    'PRE-BAG|CAV|CM|R',
    'MCF-AB02',
    pallet_id_external,
    pallet_id_external,
    20.00,
    1.00,
    0,
    0,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM (VALUES
    ('ATG2500017272'),
    ('ATG2500017271'),
    ('ATG2500017270'),
    ('ATG2500017269'),
    ('ATG2500017268'),
    ('ATG2500017266'),
    ('ATG2500017265')
  ) AS pallets(pallet_id_external)
  ON CONFLICT DO NOTHING;

  v_update_count := v_update_count + 7;
  RAISE NOTICE '  ✅ PRE-BAG|CAV|CM|R: Created 7 pallets at MCF-AB02';

  -- ============================================
  -- 2. PRE-TSH|PX|NB-* at MCF-AB04
  -- ============================================

  -- ลบ balance เก่า
  DELETE FROM wms_inventory_balances
  WHERE sku_id LIKE 'PRE-TSH|PX|NB-%'
    AND location_id = 'MCF-AB04'
    AND (pallet_id_external IS NULL OR pallet_id_external NOT LIKE 'ATG25000152%');

  -- PRE-TSH|PX|NB-3XL|B (17 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-3XL|B', 'MCF-AB04',
    'ATG2500015289', 'ATG2500015289',
    17.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  -- PRE-TSH|PX|NB-2XL|B (19 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-2XL|B', 'MCF-AB04',
    'ATG2500015288', 'ATG2500015288',
    19.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  -- PRE-TSH|PX|NB-XL|B (11 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-XL|B', 'MCF-AB04',
    'ATG2500015287', 'ATG2500015287',
    11.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  -- PRE-TSH|PX|NB-L|B (15 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-L|B', 'MCF-AB04',
    'ATG2500015286', 'ATG2500015286',
    15.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  -- PRE-TSH|PX|NB-M|B (31 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-M|B', 'MCF-AB04',
    'ATG2500015285', 'ATG2500015285',
    31.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  -- PRE-TSH|PX|NB-S|B (12 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  ) VALUES (
    'WH001', 'PRE-TSH|PX|NB-S|B', 'MCF-AB04',
    'ATG2500015284', 'ATG2500015284',
    12.00, 1.00, 0, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT DO NOTHING;

  v_update_count := v_update_count + 6;
  RAISE NOTICE '  ✅ PRE-TSH|PX|NB-*: Created 6 pallets at MCF-AB04';

  -- ============================================
  -- 3. MKT-VIN|ALL at MCF-AC01
  -- ============================================
  -- ตามข้อมูล CSV มี 18 พาเลท (ATG2500017396 ถึง 379)

  -- ลบ balance เก่า
  DELETE FROM wms_inventory_balances
  WHERE sku_id = 'MKT-VIN|ALL'
    AND location_id = 'MCF-AC01'
    AND (pallet_id_external IS NULL OR pallet_id_external NOT LIKE 'ATG25000173%');

  -- สร้าง 18 พาเลท (16 พาเลท x 10 ชิ้น)
  INSERT INTO wms_inventory_balances (
    warehouse_id, sku_id, location_id,
    pallet_id, pallet_id_external,
    total_piece_qty, total_pack_qty,
    reserved_piece_qty, reserved_pack_qty,
    created_at, updated_at
  )
  SELECT
    'WH001',
    'MKT-VIN|ALL',
    'MCF-AC01',
    pallet_id_external,
    pallet_id_external,
    10.00,
    1.00,
    0,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM (VALUES
    ('ATG2500017396'),
    ('ATG2500017395'),
    ('ATG2500017394'),
    ('ATG2500017393'),
    ('ATG2500017392'),
    ('ATG2500017391'),
    ('ATG2500017390'),
    ('ATG2500017388'),
    ('ATG2500017387'),
    ('ATG2500017386'),
    ('ATG2500017385'),
    ('ATG2500017384'),
    ('ATG2500017383'),
    ('ATG2500017381'),
    ('ATG2500017380'),
    ('ATG2500017379')
  ) AS pallets(pallet_id_external)
  ON CONFLICT DO NOTHING;

  v_update_count := v_update_count + 16;
  RAISE NOTICE '  ✅ MKT-VIN|ALL: Created 16 pallets at MCF-AC01';

  -- ============================================
  -- Summary
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration complete: Created/Updated % pallet balances', v_update_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Stock Summary:';
  RAISE NOTICE '  MCF-AB02 (PRE-BAG|CAV|CM|R): % pieces across % pallets',
    (SELECT SUM(total_piece_qty) FROM wms_inventory_balances WHERE location_id = 'MCF-AB02' AND sku_id = 'PRE-BAG|CAV|CM|R'),
    (SELECT COUNT(*) FROM wms_inventory_balances WHERE location_id = 'MCF-AB02' AND sku_id = 'PRE-BAG|CAV|CM|R');
  RAISE NOTICE '  MCF-AB04 (PRE-TSH series): % pieces across % pallets',
    (SELECT SUM(total_piece_qty) FROM wms_inventory_balances WHERE location_id = 'MCF-AB04' AND sku_id LIKE 'PRE-TSH|PX|NB-%'),
    (SELECT COUNT(*) FROM wms_inventory_balances WHERE location_id = 'MCF-AB04' AND sku_id LIKE 'PRE-TSH|PX|NB-%');
  RAISE NOTICE '  MCF-AC01 (MKT-VIN|ALL): % pieces across % pallets',
    (SELECT SUM(total_piece_qty) FROM wms_inventory_balances WHERE location_id = 'MCF-AC01' AND sku_id = 'MKT-VIN|ALL'),
    (SELECT COUNT(*) FROM wms_inventory_balances WHERE location_id = 'MCF-AC01' AND sku_id = 'MKT-VIN|ALL');

END $$;

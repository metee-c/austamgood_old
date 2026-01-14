-- Migration: Add PQTD stock for Bonus Face Sheet items
-- Purpose: เพิ่มสต็อกที่ PQTD สำหรับ BFS items ที่ขาดใน pending loadlists
-- Date: 2026-01-14
-- Note: ใช้ ledger insert เท่านั้น เพราะมี trigger sync_inventory_ledger_to_balance

DO $$
DECLARE
  v_warehouse_id VARCHAR := 'WH001';
  v_location_id VARCHAR := 'PQTD';
  v_pallet_prefix VARCHAR := 'BFS-STOCK-';
BEGIN
  -- SKU: PRE-BOW|TILT|CAT - ต้องการ 50 ชิ้น (ไม่มีสต็อก)
  INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id,
    direction, piece_qty, pack_qty,
    transaction_type, reference_doc_type, remarks
  ) VALUES (
    v_warehouse_id, v_location_id, 'PRE-BOW|TILT|CAT', v_pallet_prefix || 'PRE-BOW-001',
    'in', 100, 100,
    'adjustment', 'migration', 'Migration 212: Add BFS stock for pending loadlists'
  );

  -- SKU: TT-NET-C|FHC|0005 - ต้องการ 300 ชิ้น (ไม่มีสต็อก)
  INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id,
    direction, piece_qty, pack_qty,
    transaction_type, reference_doc_type, remarks
  ) VALUES (
    v_warehouse_id, v_location_id, 'TT-NET-C|FHC|0005', v_pallet_prefix || 'TT-FHC-001',
    'in', 500, 500,
    'adjustment', 'migration', 'Migration 212: Add BFS stock for pending loadlists'
  );

  -- SKU: TT-NET-C|FNC|0005 - ต้องการ 250 ชิ้น (ไม่มีสต็อก)
  INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id,
    direction, piece_qty, pack_qty,
    transaction_type, reference_doc_type, remarks
  ) VALUES (
    v_warehouse_id, v_location_id, 'TT-NET-C|FNC|0005', v_pallet_prefix || 'TT-FNC-001',
    'in', 400, 400,
    'adjustment', 'migration', 'Migration 212: Add BFS stock for pending loadlists'
  );

  -- SKU: PRE-BAG|SPB|MARKET - ต้องการ 100 ชิ้น (มี 20, ขาด 80)
  INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id,
    direction, piece_qty, pack_qty,
    transaction_type, reference_doc_type, remarks
  ) VALUES (
    v_warehouse_id, v_location_id, 'PRE-BAG|SPB|MARKET', v_pallet_prefix || 'PRE-BAG-001',
    'in', 200, 200,
    'adjustment', 'migration', 'Migration 212: Add BFS stock for pending loadlists'
  );

  -- SKU: TT-NET-C|CNT|0005 - ต้องการ 250 ชิ้น (ไม่มีสต็อก)
  INSERT INTO wms_inventory_ledger (
    warehouse_id, location_id, sku_id, pallet_id,
    direction, piece_qty, pack_qty,
    transaction_type, reference_doc_type, remarks
  ) VALUES (
    v_warehouse_id, v_location_id, 'TT-NET-C|CNT|0005', v_pallet_prefix || 'TT-CNT-001',
    'in', 400, 400,
    'adjustment', 'migration', 'Migration 212: Add BFS stock for pending loadlists'
  );

  RAISE NOTICE 'Migration 212: Added PQTD stock for BFS items';
  RAISE NOTICE '  - PRE-BOW|TILT|CAT: +100';
  RAISE NOTICE '  - TT-NET-C|FHC|0005: +500';
  RAISE NOTICE '  - TT-NET-C|FNC|0005: +400';
  RAISE NOTICE '  - PRE-BAG|SPB|MARKET: +200';
  RAISE NOTICE '  - TT-NET-C|CNT|0005: +400';
END $$;

-- Migration 236: ปรับลดสต็อค Dispatch ให้เหลือเท่ากับที่ต้องการสำหรับ 3 picklists
-- เก็บเฉพาะ PL-20260118-001, PL-20260118-002, PL-20260118-003
-- ไม่ลบเอกสาร แค่ปรับลดสต็อคส่วนเกิน

DO $$
DECLARE
  v_dispatch_location_id VARCHAR;
  v_system_user_id BIGINT;
  v_kept_picklist_ids INTEGER[];
  v_total_reduced INT := 0;
BEGIN
  -- ดึง location_id ของ Dispatch
  v_dispatch_location_id := (
    SELECT location_id 
    FROM master_location 
    WHERE location_code = 'Dispatch'
    LIMIT 1
  );

  -- ดึง system user
  SELECT user_id INTO v_system_user_id
  FROM master_system_user
  WHERE username = 'system'
  LIMIT 1;

  RAISE NOTICE 'Dispatch Location ID: %, System User: %', v_dispatch_location_id, v_system_user_id;

  -- ดึง IDs ของ picklists ที่เก็บไว้
  SELECT ARRAY_AGG(id) INTO v_kept_picklist_ids
  FROM picklists
  WHERE picklist_code IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003');

  RAISE NOTICE 'Picklists ที่เก็บไว้: %', v_kept_picklist_ids;

  -- ====================================
  -- คำนวณสต็อคที่ควรมี vs สต็อคปัจจุบัน
  -- ====================================
  
  -- คำนวณสต็อคที่ควรมี (จาก 3 picklists ที่เก็บไว้)
  WITH expected_stock AS (
    SELECT 
      pi.sku_id,
      SUM(pi.quantity_picked) as expected_qty
    FROM picklist_items pi
    WHERE pi.picklist_id = ANY(v_kept_picklist_ids)
    GROUP BY pi.sku_id
  ),
  -- สต็อคปัจจุบัน
  current_stock AS (
    SELECT 
      ib.sku_id,
      ib.total_piece_qty as current_qty
    FROM wms_inventory_balances ib
    WHERE ib.location_id = v_dispatch_location_id
      AND ib.total_piece_qty > 0
  ),
  -- คำนวณส่วนต่าง
  stock_diff AS (
    SELECT 
      COALESCE(cs.sku_id, es.sku_id) as sku_id,
      COALESCE(cs.current_qty, 0) as current_qty,
      COALESCE(es.expected_qty, 0) as expected_qty,
      COALESCE(cs.current_qty, 0) - COALESCE(es.expected_qty, 0) as qty_to_reduce
    FROM current_stock cs
    FULL OUTER JOIN expected_stock es ON cs.sku_id = es.sku_id
    WHERE COALESCE(cs.current_qty, 0) > COALESCE(es.expected_qty, 0)
  )
  -- ปรับลดสต็อค
  UPDATE wms_inventory_balances ib
  SET 
    total_piece_qty = total_piece_qty - sd.qty_to_reduce,
    updated_at = NOW()
  FROM stock_diff sd
  WHERE ib.sku_id = sd.sku_id
    AND ib.location_id = v_dispatch_location_id
    AND sd.qty_to_reduce > 0;

  -- นับจำนวน SKUs ที่ปรับลด
  SELECT COUNT(*) INTO v_total_reduced
  FROM (
    SELECT 
      COALESCE(cs.sku_id, es.sku_id) as sku_id,
      COALESCE(cs.current_qty, 0) - COALESCE(es.expected_qty, 0) as qty_to_reduce
    FROM (
      SELECT sku_id, total_piece_qty as current_qty
      FROM wms_inventory_balances
      WHERE location_id = v_dispatch_location_id AND total_piece_qty > 0
    ) cs
    FULL OUTER JOIN (
      SELECT sku_id, SUM(quantity_picked) as expected_qty
      FROM picklist_items
      WHERE picklist_id = ANY(v_kept_picklist_ids)
      GROUP BY sku_id
    ) es ON cs.sku_id = es.sku_id
    WHERE COALESCE(cs.current_qty, 0) > COALESCE(es.expected_qty, 0)
  ) t;

  -- บันทึก ledger (skip trigger เพื่อไม่ให้ sync กลับไป balance)
  WITH stock_diff AS (
    SELECT 
      COALESCE(cs.sku_id, es.sku_id) as sku_id,
      COALESCE(cs.current_qty, 0) - COALESCE(es.expected_qty, 0) as qty_to_reduce
    FROM (
      SELECT sku_id, total_piece_qty as current_qty
      FROM wms_inventory_balances
      WHERE location_id = v_dispatch_location_id AND total_piece_qty > 0
    ) cs
    FULL OUTER JOIN (
      SELECT sku_id, SUM(quantity_picked) as expected_qty
      FROM picklist_items
      WHERE picklist_id = ANY(v_kept_picklist_ids)
      GROUP BY sku_id
    ) es ON cs.sku_id = es.sku_id
    WHERE COALESCE(cs.current_qty, 0) > COALESCE(es.expected_qty, 0)
  )
  INSERT INTO wms_inventory_ledger (
    sku_id,
    warehouse_id,
    location_id,
    transaction_type,
    direction,
    piece_qty,
    reference_doc_type,
    reference_doc_id,
    remarks,
    created_by,
    created_at,
    skip_balance_sync
  )
  SELECT 
    sd.sku_id,
    'WH001',
    v_dispatch_location_id,
    'adjustment',
    'out',
    sd.qty_to_reduce,
    'migration',
    '236',
    'Migration 236: ปรับลดสต็อคส่วนเกินที่ Dispatch',
    v_system_user_id,
    NOW(),
    true
  FROM stock_diff sd
  WHERE sd.qty_to_reduce > 0;

  -- ====================================
  -- สรุปผล
  -- ====================================
  
  RAISE NOTICE '=== สรุปผลการทำงาน ===';
  RAISE NOTICE 'เก็บ Picklists: 3 ใบ (PL-20260118-001, 002, 003)';
  RAISE NOTICE 'ปรับลดสต็อค Dispatch: % SKUs', v_total_reduced;
  RAISE NOTICE 'ไม่ลบเอกสารใดๆ - เก็บไว้ทั้งหมด';

END $$;

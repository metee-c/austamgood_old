-- Migration: Clear MRTD and PQTD stock after loading confirmation
-- Issue: Stock remains in wms_inventory_balances at MRTD/PQTD even after packages are loaded
-- Root cause: Loading confirmation (bfs_confirmed_to_staging) doesn't deduct stock from MRTD/PQTD
-- Solution: Clear all stock at MRTD and PQTD locations since packages are already loaded

-- ✅ Step 1: Record current stock for audit trail
CREATE TEMP TABLE temp_mrtd_pqtd_stock AS
SELECT 
  balance_id,
  warehouse_id,
  location_id,
  sku_id,
  pallet_id,
  total_pack_qty,
  total_piece_qty,
  reserved_pack_qty,
  reserved_piece_qty
FROM wms_inventory_balances
WHERE location_id IN ('MRTD', 'PQTD')
  AND (total_pack_qty > 0 OR total_piece_qty > 0);

-- Log summary
DO $$
DECLARE
  v_total_records INT;
  v_total_pack NUMERIC;
  v_total_piece NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    SUM(total_pack_qty),
    SUM(total_piece_qty)
  INTO v_total_records, v_total_pack, v_total_piece
  FROM temp_mrtd_pqtd_stock;
  
  RAISE NOTICE '📊 Found % records with stock at MRTD/PQTD', v_total_records;
  RAISE NOTICE '   Total: % packs + % pieces', v_total_pack, v_total_piece;
END $$;

-- ✅ Step 2: Create ledger entries for stock deduction (ship transaction)
-- Note: wms_inventory_ledger does not have lot_no column
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
  reference_doc_id,
  remarks,
  created_at
)
SELECT 
  b.warehouse_id,
  b.location_id,
  b.sku_id,
  b.pallet_id,
  b.pallet_id_external,
  b.production_date,
  b.expiry_date,
  'ship' AS transaction_type,
  'out' AS direction,
  b.total_pack_qty AS pack_qty,
  b.total_piece_qty AS piece_qty,
  'migration' AS reference_doc_type,
  244 AS reference_doc_id,
  'Clear MRTD/PQTD stock after loading confirmation (Migration 244)' AS remarks,
  NOW() AS created_at
FROM wms_inventory_balances b
WHERE b.location_id IN ('MRTD', 'PQTD')
  AND (b.total_pack_qty > 0 OR b.total_piece_qty > 0);

-- ✅ Step 3: Clear stock from wms_inventory_balances
UPDATE wms_inventory_balances
SET 
  total_pack_qty = 0,
  total_piece_qty = 0,
  reserved_pack_qty = 0,
  reserved_piece_qty = 0,
  updated_at = NOW()
WHERE location_id IN ('MRTD', 'PQTD')
  AND (total_pack_qty > 0 OR total_piece_qty > 0);

-- ✅ Step 4: Verify results
DO $$
DECLARE
  v_remaining_records INT;
BEGIN
  SELECT COUNT(*)
  INTO v_remaining_records
  FROM wms_inventory_balances
  WHERE location_id IN ('MRTD', 'PQTD')
    AND (total_pack_qty > 0 OR total_piece_qty > 0);
  
  IF v_remaining_records > 0 THEN
    RAISE WARNING '⚠️ Still have % records with stock at MRTD/PQTD', v_remaining_records;
  ELSE
    RAISE NOTICE '✅ Successfully cleared all stock from MRTD/PQTD';
  END IF;
END $$;

-- ✅ Step 5: Add comment
COMMENT ON TABLE wms_inventory_balances IS 'Inventory balances by location, SKU, and pallet. Migration 244: Cleared MRTD/PQTD stock after loading confirmation.';

-- Migration: Fix stock transfer for loadlist LD-20260112-0008
-- Problem: Picklist items were picked but stock wasn't transferred to PQTD staging area
-- Solution: Transfer stock from PK001 and bulk storage to PQTD

BEGIN;

-- =====================================================
-- 1. Transfer stock from PK001 to PQTD for loadlist LD-20260112-0008
-- =====================================================

-- SKUs that have stock at PK001:
-- B-BEY-C|LAM|070: need 20, PK001 has 330
-- B-BEY-C|MCK|070: need 20, PK001 has 471
-- B-BEY-C|MNB|070: need 40, PK001 has 973
-- B-BEY-C|MNB|NS|010: need 24, PK001 has 576
-- B-BEY-C|SAL|070: need 40, PK001 has 1309
-- B-BEY-C|TUN|070: need 20, PK001 has 369
-- B-BEY-D|BEF|100: need 10, PK001 has 292
-- B-BEY-D|CNL|100: need 10, PK001 has 130
-- B-BEY-D|LAM|100: need 10, PK001 has 263
-- B-BEY-D|MNB|070: need 10, PK001 has 173
-- B-BEY-D|SAL|100: need 20, PK001 has 204
-- B-NET-C|FNC|010: need 60, PK001 has 4456
-- B-NET-C|FNC|040: need 40, PK001 has 234

-- Create PQTD records for SKUs that need transfer
INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, created_at, updated_at)
SELECT 'WH001', 'PQTD', sku_id, 0, 0, NOW(), NOW()
FROM (VALUES 
  ('B-BEY-C|LAM|070'),
  ('B-BEY-C|MCK|070'),
  ('B-BEY-C|MNB|070'),
  ('B-BEY-C|MNB|NS|010'),
  ('B-BEY-C|SAL|070'),
  ('B-BEY-C|TUN|070'),
  ('B-BEY-D|BEF|100'),
  ('B-BEY-D|CNL|100'),
  ('B-BEY-D|LAM|100'),
  ('B-BEY-D|MNB|070'),
  ('B-BEY-D|SAL|100'),
  ('B-NET-C|FNC|010'),
  ('B-NET-C|FNC|040')
) AS v(sku_id)
WHERE NOT EXISTS (
  SELECT 1 FROM wms_inventory_balances 
  WHERE location_id = 'PQTD' AND wms_inventory_balances.sku_id = v.sku_id
);

-- Transfer from PK001 to PQTD
-- B-BEY-C|LAM|070: 20
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|LAM|070' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|LAM|070';

-- B-BEY-C|MCK|070: 20
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|MCK|070' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|MCK|070';

-- B-BEY-C|MNB|070: 40
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 40, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|MNB|070' AND total_piece_qty >= 40;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 40, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|MNB|070';

-- B-BEY-C|MNB|NS|010: 24
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 24, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|MNB|NS|010' AND total_piece_qty >= 24;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 24, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|MNB|NS|010';

-- B-BEY-C|SAL|070: 40
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 40, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|SAL|070' AND total_piece_qty >= 40;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 40, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|SAL|070';

-- B-BEY-C|TUN|070: 20
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-C|TUN|070' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|TUN|070';

-- B-BEY-D|BEF|100: 10
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 10, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-D|BEF|100' AND total_piece_qty >= 10;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 10, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-D|BEF|100';

-- B-BEY-D|CNL|100: 10
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 10, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-D|CNL|100' AND total_piece_qty >= 10;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 10, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-D|CNL|100';

-- B-BEY-D|LAM|100: 10
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 10, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-D|LAM|100' AND total_piece_qty >= 10;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 10, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-D|LAM|100';

-- B-BEY-D|MNB|070: 10
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 10, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-D|MNB|070' AND total_piece_qty >= 10;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 10, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-D|MNB|070';

-- B-BEY-D|SAL|100: 20
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-BEY-D|SAL|100' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-D|SAL|100';

-- B-NET-C|FNC|010: 60
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 60, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-NET-C|FNC|010' AND total_piece_qty >= 60;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 60, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|FNC|010';

-- B-NET-C|FNC|040: 40
UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 40, updated_at = NOW()
WHERE location_id = 'PK001' AND sku_id = 'B-NET-C|FNC|040' AND total_piece_qty >= 40;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 40, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|FNC|040';

-- =====================================================
-- 2. Transfer stock from bulk storage for SKUs not in PK001
-- =====================================================

-- B-BAP-C|WEP|030: need 12, transfer from A10-01-020 (has 435)
INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, created_at, updated_at)
SELECT 'WH001', 'PQTD', 'B-BAP-C|WEP|030', 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM wms_inventory_balances WHERE location_id = 'PQTD' AND sku_id = 'B-BAP-C|WEP|030');

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 12, updated_at = NOW()
WHERE location_id = 'A10-01-020' AND sku_id = 'B-BAP-C|WEP|030' AND total_piece_qty >= 12;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 12, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BAP-C|WEP|030';

-- B-BEY-C|TUN|NS|010: need 60, transfer from A09-03-008 (has 576)
INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, created_at, updated_at)
SELECT 'WH001', 'PQTD', 'B-BEY-C|TUN|NS|010', 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM wms_inventory_balances WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|TUN|NS|010');

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 60, updated_at = NOW()
WHERE location_id = 'A09-03-008' AND sku_id = 'B-BEY-C|TUN|NS|010' AND total_piece_qty >= 60;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 60, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-BEY-C|TUN|NS|010';

-- B-NET-C|FHC|040: need 20, transfer from AB-BLK-27 (has 480)
INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, created_at, updated_at)
SELECT 'WH001', 'PQTD', 'B-NET-C|FHC|040', 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM wms_inventory_balances WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|FHC|040');

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'AB-BLK-27' AND sku_id = 'B-NET-C|FHC|040' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|FHC|040';

-- B-NET-C|SAL|040: need 20, transfer from AB-BLK-25 (has 404)
INSERT INTO wms_inventory_balances (warehouse_id, location_id, sku_id, total_piece_qty, total_pack_qty, created_at, updated_at)
SELECT 'WH001', 'PQTD', 'B-NET-C|SAL|040', 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM wms_inventory_balances WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|SAL|040');

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty - 20, updated_at = NOW()
WHERE location_id = 'AB-BLK-25' AND sku_id = 'B-NET-C|SAL|040' AND total_piece_qty >= 20;

UPDATE wms_inventory_balances SET total_piece_qty = total_piece_qty + 20, updated_at = NOW()
WHERE location_id = 'PQTD' AND sku_id = 'B-NET-C|SAL|040';

COMMIT;

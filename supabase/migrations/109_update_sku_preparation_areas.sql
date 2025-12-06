-- ============================================================
-- Migration: 109_update_sku_preparation_areas.sql
-- Description: อัปเดตโลเคชั่นบ้านหยิบ (Preparation Area) ให้กับ SKU
-- Date: 2025-12-06
-- ============================================================
-- คำอธิบาย: อัปเดต default_location ใน master_sku ตามข้อมูลที่กำหนด
--           - ถ้า SKU มีอยู่แล้ว จะอัปเดตโลเคชั่นใหม่
--           - ถ้า SKU ไม่มีในรายการ จะคงค่าเดิมไว้
--           - 1 โลเคชั่น : 1 SKU (บ้านหยิบเฉพาะสำหรับแต่ละ SKU)
-- ============================================================

-- อัปเดต default_location สำหรับ SKU ที่กำหนด
UPDATE master_sku
SET 
  default_location = data.location_code,
  updated_at = CURRENT_TIMESTAMP
FROM (VALUES
  -- Zone A09-01 (Buzz Beyond & Buzz Netura & Buzz Balanced+)
  ('B-BEY-C|LAM|NS|010', 'A09-01-001'),
  ('B-BEY-C|MCK|NS|010', 'A09-01-002'),
  ('B-BEY-C|MNB|NS|010', 'A09-01-003'),
  ('B-BEY-C|SAL|NS|010', 'A09-01-004'),
  ('B-BEY-C|TUN|NS|010', 'A09-01-005'),
  ('B-BEY-D|BEF|NS|012', 'A09-01-006'),
  ('B-BEY-D|CNL|NS|012', 'A09-01-007'),
  ('B-BEY-D|LAM|NS|012', 'A09-01-008'),
  ('B-BEY-D|MNB|NS|010', 'A09-01-009'),
  ('B-BEY-D|SAL|NS|012', 'A09-01-010'),
  ('B-NET-D|CHI-L|008', 'A09-01-011'),
  ('B-NET-D|CHI-S|008', 'A09-01-012'),
  ('B-NET-D|SAL-L|008', 'A09-01-013'),
  ('B-NET-D|SAL-S|008', 'A09-01-014'),
  ('B-NET-D|CHI-L|025', 'A09-01-015'),
  ('B-NET-D|CHI-S|025', 'A09-01-016'),
  ('B-NET-D|SAL-L|025', 'A09-01-017'),
  ('B-NET-D|SAL-S|025', 'A09-01-018'),
  ('B-BAP-C|HNS|010', 'A09-01-019'),
  ('B-BAP-C|HNS|030', 'A09-01-020'),
  ('B-BAP-C|IND|010', 'A09-01-021'),
  ('B-BAP-C|IND|030', 'A09-01-022'),
  ('B-BAP-C|KNP|010', 'A09-01-023'),
  ('B-BAP-C|KNP|030', 'A09-01-024'),
  ('B-BAP-C|WEP|010', 'A09-01-025'),
  ('B-BAP-C|WEP|030', 'A09-01-026'),
  
  -- Zone A10-01 (Tester Products)
  ('TT-BAP-C|HNS|0005', 'A10-01-001'),
  ('TT-BAP-C|IND|0005', 'A10-01-002'),
  ('TT-BAP-C|KNP|0005', 'A10-01-003'),
  ('TT-BAP-C|WEP|0005', 'A10-01-004'),
  ('TT-BEY-C|LAM|0005', 'A10-01-005'),
  ('TT-BEY-C|MCK|0005', 'A10-01-006'),
  ('TT-BEY-C|MNB|0005', 'A10-01-007'),
  ('TT-BEY-C|SAL|0005', 'A10-01-008'),
  ('TT-BEY-C|TUN|0005', 'A10-01-009'),
  ('TT-BEY-D|BEF|0005', 'A10-01-010'),
  ('TT-BEY-D|CNL|0005', 'A10-01-011'),
  ('TT-BEY-D|LAM|0005', 'A10-01-012'),
  ('TT-BEY-D|MNB|0005', 'A10-01-013'),
  ('TT-BEY-D|SAL|0005', 'A10-01-014'),
  ('TT-NET-C|FHC|0005', 'A10-01-015'),
  ('TT-NET-C|FNC|0005', 'A10-01-016'),
  ('TT-NET-C|SAL|0005', 'A10-01-017'),
  ('TT-NET-D|CHI-L|0005', 'A10-01-018'),
  ('TT-NET-D|CHI-S|0005', 'A10-01-019'),
  ('TT-NET-D|SAL-L|0005', 'A10-01-020'),
  ('TT-NET-D|SAL-S|0005', 'A10-01-021'),
  ('TT-NET-C|CNT|0005', 'A10-01-022')
) AS data(sku_id, location_code)
WHERE master_sku.sku_id = data.sku_id;

-- Log: แสดงจำนวน SKU ที่อัปเดต
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM master_sku
  WHERE default_location IN (
    'A09-01-001', 'A09-01-002', 'A09-01-003', 'A09-01-004', 'A09-01-005',
    'A09-01-006', 'A09-01-007', 'A09-01-008', 'A09-01-009', 'A09-01-010',
    'A09-01-011', 'A09-01-012', 'A09-01-013', 'A09-01-014', 'A09-01-015',
    'A09-01-016', 'A09-01-017', 'A09-01-018', 'A09-01-019', 'A09-01-020',
    'A09-01-021', 'A09-01-022', 'A09-01-023', 'A09-01-024', 'A09-01-025',
    'A09-01-026', 'A10-01-001', 'A10-01-002', 'A10-01-003', 'A10-01-004',
    'A10-01-005', 'A10-01-006', 'A10-01-007', 'A10-01-008', 'A10-01-009',
    'A10-01-010', 'A10-01-011', 'A10-01-012', 'A10-01-013', 'A10-01-014',
    'A10-01-015', 'A10-01-016', 'A10-01-017', 'A10-01-018', 'A10-01-019',
    'A10-01-020', 'A10-01-021', 'A10-01-022'
  );
  
  RAISE NOTICE 'Migration 109: Updated % SKU preparation areas', updated_count;
END $$;

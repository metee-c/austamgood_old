-- ============================================================
-- Migration: 112_create_dedicated_zones_and_prep_areas.sql
-- Description: สร้าง location, zone และ preparation area เฉพาะสำหรับแต่ละ SKU
-- Date: 2025-12-06
-- ============================================================
-- วัตถุประสงค์: แก้ปัญหาที่ migration 109 ใช้ location_code แทน area_code
--               โดยสร้าง location และ zone แยกสำหรับแต่ละ SKU
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: สร้าง master_location records สำหรับแต่ละ SKU
-- ============================================================

-- Zone A09-01 (Buzz Beyond & Buzz Netura & Buzz Balanced+)
INSERT INTO master_location (
  location_id, location_code, location_name, zone, 
  warehouse_id, location_type, active_status, 
  created_by, created_at, updated_at
) VALUES
  ('A09-01-001', 'A09-01-001', 'บ้านหยิบ B-BEY-C|LAM|NS|010', 'Zone Selective Rack A09-01-001', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-002', 'A09-01-002', 'บ้านหยิบ B-BEY-C|MCK|NS|010', 'Zone Selective Rack A09-01-002', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-003', 'A09-01-003', 'บ้านหยิบ B-BEY-C|MNB|NS|010', 'Zone Selective Rack A09-01-003', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-004', 'A09-01-004', 'บ้านหยิบ B-BEY-C|SAL|NS|010', 'Zone Selective Rack A09-01-004', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-005', 'A09-01-005', 'บ้านหยิบ B-BEY-C|TUN|NS|010', 'Zone Selective Rack A09-01-005', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-006', 'A09-01-006', 'บ้านหยิบ B-BEY-D|BEF|NS|012', 'Zone Selective Rack A09-01-006', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-007', 'A09-01-007', 'บ้านหยิบ B-BEY-D|CNL|NS|012', 'Zone Selective Rack A09-01-007', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-008', 'A09-01-008', 'บ้านหยิบ B-BEY-D|LAM|NS|012', 'Zone Selective Rack A09-01-008', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-009', 'A09-01-009', 'บ้านหยิบ B-BEY-D|MNB|NS|010', 'Zone Selective Rack A09-01-009', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-010', 'A09-01-010', 'บ้านหยิบ B-BEY-D|SAL|NS|012', 'Zone Selective Rack A09-01-010', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-011', 'A09-01-011', 'บ้านหยิบ B-NET-D|CHI-L|008', 'Zone Selective Rack A09-01-011', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-012', 'A09-01-012', 'บ้านหยิบ B-NET-D|CHI-S|008', 'Zone Selective Rack A09-01-012', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-013', 'A09-01-013', 'บ้านหยิบ B-NET-D|SAL-L|008', 'Zone Selective Rack A09-01-013', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-014', 'A09-01-014', 'บ้านหยิบ B-NET-D|SAL-S|008', 'Zone Selective Rack A09-01-014', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-015', 'A09-01-015', 'บ้านหยิบ B-NET-D|CHI-L|025', 'Zone Selective Rack A09-01-015', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-016', 'A09-01-016', 'บ้านหยิบ B-NET-D|CHI-S|025', 'Zone Selective Rack A09-01-016', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-017', 'A09-01-017', 'บ้านหยิบ B-NET-D|SAL-L|025', 'Zone Selective Rack A09-01-017', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-018', 'A09-01-018', 'บ้านหยิบ B-NET-D|SAL-S|025', 'Zone Selective Rack A09-01-018', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-019', 'A09-01-019', 'บ้านหยิบ B-BAP-C|HNS|010', 'Zone Selective Rack A09-01-019', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-020', 'A09-01-020', 'บ้านหยิบ B-BAP-C|HNS|030', 'Zone Selective Rack A09-01-020', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-021', 'A09-01-021', 'บ้านหยิบ B-BAP-C|IND|010', 'Zone Selective Rack A09-01-021', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-022', 'A09-01-022', 'บ้านหยิบ B-BAP-C|IND|030', 'Zone Selective Rack A09-01-022', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-023', 'A09-01-023', 'บ้านหยิบ B-BAP-C|KNP|010', 'Zone Selective Rack A09-01-023', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-024', 'A09-01-024', 'บ้านหยิบ B-BAP-C|KNP|030', 'Zone Selective Rack A09-01-024', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-025', 'A09-01-025', 'บ้านหยิบ B-BAP-C|WEP|010', 'Zone Selective Rack A09-01-025', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-026', 'A09-01-026', 'บ้านหยิบ B-BAP-C|WEP|030', 'Zone Selective Rack A09-01-026', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Zone A10-01 (Tester Products)
INSERT INTO master_location (
  location_id, location_code, location_name, zone, 
  warehouse_id, location_type, active_status, 
  created_by, created_at, updated_at
) VALUES
  ('A10-01-001', 'A10-01-001', 'บ้านหยิบ TT-BAP-C|HNS|0005', 'Zone Selective Rack A10-01-001', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-002', 'A10-01-002', 'บ้านหยิบ TT-BAP-C|IND|0005', 'Zone Selective Rack A10-01-002', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-003', 'A10-01-003', 'บ้านหยิบ TT-BAP-C|KNP|0005', 'Zone Selective Rack A10-01-003', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-004', 'A10-01-004', 'บ้านหยิบ TT-BAP-C|WEP|0005', 'Zone Selective Rack A10-01-004', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-005', 'A10-01-005', 'บ้านหยิบ TT-BEY-C|LAM|0005', 'Zone Selective Rack A10-01-005', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-006', 'A10-01-006', 'บ้านหยิบ TT-BEY-C|MCK|0005', 'Zone Selective Rack A10-01-006', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-007', 'A10-01-007', 'บ้านหยิบ TT-BEY-C|MNB|0005', 'Zone Selective Rack A10-01-007', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-008', 'A10-01-008', 'บ้านหยิบ TT-BEY-C|SAL|0005', 'Zone Selective Rack A10-01-008', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-009', 'A10-01-009', 'บ้านหยิบ TT-BEY-C|TUN|0005', 'Zone Selective Rack A10-01-009', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-010', 'A10-01-010', 'บ้านหยิบ TT-BEY-D|BEF|0005', 'Zone Selective Rack A10-01-010', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-011', 'A10-01-011', 'บ้านหยิบ TT-BEY-D|CNL|0005', 'Zone Selective Rack A10-01-011', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-012', 'A10-01-012', 'บ้านหยิบ TT-BEY-D|LAM|0005', 'Zone Selective Rack A10-01-012', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-013', 'A10-01-013', 'บ้านหยิบ TT-BEY-D|MNB|0005', 'Zone Selective Rack A10-01-013', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-014', 'A10-01-014', 'บ้านหยิบ TT-BEY-D|SAL|0005', 'Zone Selective Rack A10-01-014', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-015', 'A10-01-015', 'บ้านหยิบ TT-NET-C|FHC|0005', 'Zone Selective Rack A10-01-015', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-016', 'A10-01-016', 'บ้านหยิบ TT-NET-C|FNC|0005', 'Zone Selective Rack A10-01-016', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-017', 'A10-01-017', 'บ้านหยิบ TT-NET-C|SAL|0005', 'Zone Selective Rack A10-01-017', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-018', 'A10-01-018', 'บ้านหยิบ TT-NET-D|CHI-L|0005', 'Zone Selective Rack A10-01-018', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-019', 'A10-01-019', 'บ้านหยิบ TT-NET-D|CHI-S|0005', 'Zone Selective Rack A10-01-019', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-020', 'A10-01-020', 'บ้านหยิบ TT-NET-D|SAL-L|0005', 'Zone Selective Rack A10-01-020', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-021', 'A10-01-021', 'บ้านหยิบ TT-NET-D|SAL-S|0005', 'Zone Selective Rack A10-01-021', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-022', 'A10-01-022', 'บ้านหยิบ TT-NET-C|CNT|0005', 'Zone Selective Rack A10-01-022', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- STEP 2: สร้าง preparation_area records สำหรับแต่ละ location
-- ============================================================

-- Zone A09-01 (Buzz Beyond & Buzz Netura & Buzz Balanced+)
INSERT INTO preparation_area (
  area_code, area_name, zone, warehouse_id, area_type, 
  status, created_by, created_at, updated_at
) VALUES
  ('A09-01-001', 'บ้านหยิบเฉพาะ B-BEY-C|LAM|NS|010', 'Zone Selective Rack A09-01-001', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-002', 'บ้านหยิบเฉพาะ B-BEY-C|MCK|NS|010', 'Zone Selective Rack A09-01-002', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-003', 'บ้านหยิบเฉพาะ B-BEY-C|MNB|NS|010', 'Zone Selective Rack A09-01-003', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-004', 'บ้านหยิบเฉพาะ B-BEY-C|SAL|NS|010', 'Zone Selective Rack A09-01-004', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-005', 'บ้านหยิบเฉพาะ B-BEY-C|TUN|NS|010', 'Zone Selective Rack A09-01-005', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-006', 'บ้านหยิบเฉพาะ B-BEY-D|BEF|NS|012', 'Zone Selective Rack A09-01-006', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-007', 'บ้านหยิบเฉพาะ B-BEY-D|CNL|NS|012', 'Zone Selective Rack A09-01-007', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-008', 'บ้านหยิบเฉพาะ B-BEY-D|LAM|NS|012', 'Zone Selective Rack A09-01-008', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-009', 'บ้านหยิบเฉพาะ B-BEY-D|MNB|NS|010', 'Zone Selective Rack A09-01-009', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-010', 'บ้านหยิบเฉพาะ B-BEY-D|SAL|NS|012', 'Zone Selective Rack A09-01-010', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-011', 'บ้านหยิบเฉพาะ B-NET-D|CHI-L|008', 'Zone Selective Rack A09-01-011', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-012', 'บ้านหยิบเฉพาะ B-NET-D|CHI-S|008', 'Zone Selective Rack A09-01-012', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-013', 'บ้านหยิบเฉพาะ B-NET-D|SAL-L|008', 'Zone Selective Rack A09-01-013', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-014', 'บ้านหยิบเฉพาะ B-NET-D|SAL-S|008', 'Zone Selective Rack A09-01-014', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-015', 'บ้านหยิบเฉพาะ B-NET-D|CHI-L|025', 'Zone Selective Rack A09-01-015', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-016', 'บ้านหยิบเฉพาะ B-NET-D|CHI-S|025', 'Zone Selective Rack A09-01-016', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-017', 'บ้านหยิบเฉพาะ B-NET-D|SAL-L|025', 'Zone Selective Rack A09-01-017', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-018', 'บ้านหยิบเฉพาะ B-NET-D|SAL-S|025', 'Zone Selective Rack A09-01-018', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-019', 'บ้านหยิบเฉพาะ B-BAP-C|HNS|010', 'Zone Selective Rack A09-01-019', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-020', 'บ้านหยิบเฉพาะ B-BAP-C|HNS|030', 'Zone Selective Rack A09-01-020', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-021', 'บ้านหยิบเฉพาะ B-BAP-C|IND|010', 'Zone Selective Rack A09-01-021', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-022', 'บ้านหยิบเฉพาะ B-BAP-C|IND|030', 'Zone Selective Rack A09-01-022', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-023', 'บ้านหยิบเฉพาะ B-BAP-C|KNP|010', 'Zone Selective Rack A09-01-023', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-024', 'บ้านหยิบเฉพาะ B-BAP-C|KNP|030', 'Zone Selective Rack A09-01-024', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-025', 'บ้านหยิบเฉพาะ B-BAP-C|WEP|010', 'Zone Selective Rack A09-01-025', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A09-01-026', 'บ้านหยิบเฉพาะ B-BAP-C|WEP|030', 'Zone Selective Rack A09-01-026', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Zone A10-01 (Tester Products)
INSERT INTO preparation_area (
  area_code, area_name, zone, warehouse_id, area_type, 
  status, created_by, created_at, updated_at
) VALUES
  ('A10-01-001', 'บ้านหยิบเฉพาะ TT-BAP-C|HNS|0005', 'Zone Selective Rack A10-01-001', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-002', 'บ้านหยิบเฉพาะ TT-BAP-C|IND|0005', 'Zone Selective Rack A10-01-002', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-003', 'บ้านหยิบเฉพาะ TT-BAP-C|KNP|0005', 'Zone Selective Rack A10-01-003', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-004', 'บ้านหยิบเฉพาะ TT-BAP-C|WEP|0005', 'Zone Selective Rack A10-01-004', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-005', 'บ้านหยิบเฉพาะ TT-BEY-C|LAM|0005', 'Zone Selective Rack A10-01-005', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-006', 'บ้านหยิบเฉพาะ TT-BEY-C|MCK|0005', 'Zone Selective Rack A10-01-006', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-007', 'บ้านหยิบเฉพาะ TT-BEY-C|MNB|0005', 'Zone Selective Rack A10-01-007', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-008', 'บ้านหยิบเฉพาะ TT-BEY-C|SAL|0005', 'Zone Selective Rack A10-01-008', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-009', 'บ้านหยิบเฉพาะ TT-BEY-C|TUN|0005', 'Zone Selective Rack A10-01-009', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-010', 'บ้านหยิบเฉพาะ TT-BEY-D|BEF|0005', 'Zone Selective Rack A10-01-010', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-011', 'บ้านหยิบเฉพาะ TT-BEY-D|CNL|0005', 'Zone Selective Rack A10-01-011', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-012', 'บ้านหยิบเฉพาะ TT-BEY-D|LAM|0005', 'Zone Selective Rack A10-01-012', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-013', 'บ้านหยิบเฉพาะ TT-BEY-D|MNB|0005', 'Zone Selective Rack A10-01-013', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-014', 'บ้านหยิบเฉพาะ TT-BEY-D|SAL|0005', 'Zone Selective Rack A10-01-014', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-015', 'บ้านหยิบเฉพาะ TT-NET-C|FHC|0005', 'Zone Selective Rack A10-01-015', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-016', 'บ้านหยิบเฉพาะ TT-NET-C|FNC|0005', 'Zone Selective Rack A10-01-016', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-017', 'บ้านหยิบเฉพาะ TT-NET-C|SAL|0005', 'Zone Selective Rack A10-01-017', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-018', 'บ้านหยิบเฉพาะ TT-NET-D|CHI-L|0005', 'Zone Selective Rack A10-01-018', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-019', 'บ้านหยิบเฉพาะ TT-NET-D|CHI-S|0005', 'Zone Selective Rack A10-01-019', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-020', 'บ้านหยิบเฉพาะ TT-NET-D|SAL-L|0005', 'Zone Selective Rack A10-01-020', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-021', 'บ้านหยิบเฉพาะ TT-NET-D|SAL-S|0005', 'Zone Selective Rack A10-01-021', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('A10-01-022', 'บ้านหยิบเฉพาะ TT-NET-C|CNT|0005', 'Zone Selective Rack A10-01-022', 'WH001', 'rack', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ============================================================
-- STEP 3: Log และตรวจสอบผลลัพธ์
-- ============================================================

DO $$
DECLARE
  v_location_count INTEGER;
  v_prep_area_count INTEGER;
BEGIN
  -- นับจำนวน location ที่สร้าง/อัปเดต
  SELECT COUNT(*) INTO v_location_count
  FROM master_location
  WHERE zone LIKE 'Zone Selective Rack A09-01-%'
     OR zone LIKE 'Zone Selective Rack A10-01-%';
  
  -- นับจำนวน preparation_area ที่สร้าง
  SELECT COUNT(*) INTO v_prep_area_count
  FROM preparation_area
  WHERE area_code LIKE 'A09-01-%'
     OR area_code LIKE 'A10-01-%';
  
  RAISE NOTICE '✅ Migration 112 completed:';
  RAISE NOTICE '   - Created/Updated % master_location records with dedicated zones', v_location_count;
  RAISE NOTICE '   - Created % preparation_area records', v_prep_area_count;
  
  IF v_location_count = 48 AND v_prep_area_count = 48 THEN
    RAISE NOTICE '🎉 SUCCESS: All 48 locations and preparation areas created!';
  ELSE
    RAISE WARNING '⚠️  Expected 48 locations and 48 prep areas, but got % and %', v_location_count, v_prep_area_count;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- สรุปผลลัพธ์
-- ============================================================
-- ตอนนี้ระบบจะทำงานแบบนี้:
--
-- master_sku.default_location = 'A09-01-001'
--   ↓
-- preparation_area WHERE area_code = 'A09-01-001'
--   → zone = 'Zone Selective Rack A09-01-001'
--   ↓
-- master_location WHERE zone = 'Zone Selective Rack A09-01-001'
--   → location_id = 'A09-01-001' (1 location เฉพาะ)
--   ↓
-- Query stock จาก location นั้นเฉพาะตัว
--
-- ✅ Workflow ทั้งหมดทำงานตามเดิม โดยไม่ต้องแก้ code
-- ✅ รักษา concept "1 SKU = 1 บ้านหยิบ" ได้
-- ✅ Picklist, Face Sheet, Bonus Face Sheet ทำงานได้ปกติ
-- ============================================================

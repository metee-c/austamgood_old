-- Migration: Insert Food Material BOM Records
-- This adds food materials (อาหาร) to the BOM for all finished products
-- Rules:
--   Balanced series: food material has same size as finished product
--   Balanced+, Beyond, Netura series: food material is 20kg bulk
--   Netura+ series: food material is 15kg bulk

-- =====================================================
-- PART 1: Buzz Balanced Series (same size food material)
-- =====================================================

-- Balanced Cat Adult (แมวโต)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
VALUES
  ('BOM-B-BAL-C|LAM|012-FOOD', 'B-BAL-C|LAM|012', '00-BAL-C|LAM|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|LAM|028-FOOD', 'B-BAL-C|LAM|028', '00-BAL-C|LAM|028', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|LAM|070-FOOD', 'B-BAL-C|LAM|070', '00-BAL-C|LAM|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|SAL|012-FOOD', 'B-BAL-C|SAL|012', '00-BAL-C|SAL|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|SAL|028-FOOD', 'B-BAL-C|SAL|028', '00-BAL-C|SAL|028', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|SAL|070-FOOD', 'B-BAL-C|SAL|070', '00-BAL-C|SAL|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|TUN|012-FOOD', 'B-BAL-C|TUN|012', '00-BAL-C|TUN|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|TUN|028-FOOD', 'B-BAL-C|TUN|028', '00-BAL-C|TUN|028', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|TUN|070-FOOD', 'B-BAL-C|TUN|070', '00-BAL-C|TUN|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|MCK|012-FOOD', 'B-BAL-C|MCK|012', '00-BAL-C|MCK|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|MCK|028-FOOD', 'B-BAL-C|MCK|028', '00-BAL-C|MCK|028', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|MCK|070-FOOD', 'B-BAL-C|MCK|070', '00-BAL-C|MCK|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|CRB|012-FOOD', 'B-BAL-C|CRB|012', '00-BAL-C|CRB|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|CRB|070-FOOD', 'B-BAL-C|CRB|070', '00-BAL-C|CRB|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|LOB|012-FOOD', 'B-BAL-C|LOB|012', '00-BAL-C|LOB|012', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|LOB|070-FOOD', 'B-BAL-C|LOB|070', '00-BAL-C|LOB|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Balanced Kitten (ลูกแมว)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BAL-C|KIT|010-FOOD', 'B-BAL-C|KIT|010', '00-BAL-C|KIT|010', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|KIT|025-FOOD', 'B-BAL-C|KIT|025', '00-BAL-C|KIT|025', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-C|KIT|070-FOOD', 'B-BAL-C|KIT|070', '00-BAL-C|KIT|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Balanced Puppy (ลูกสุนัข)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BAL-D|PUP|010-FOOD', 'B-BAL-D|PUP|010', '00-BAL-D|PUP|010', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|PUP|070-FOOD', 'B-BAL-D|PUP|070', '00-BAL-D|PUP|070', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Balanced Dog Adult (สุนัขโต)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BAL-D|LAM|015-FOOD', 'B-BAL-D|LAM|015', '00-BAL-D|LAM|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|LAM|150-FOOD', 'B-BAL-D|LAM|150', '00-BAL-D|LAM|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|SAL|015-FOOD', 'B-BAL-D|SAL|015', '00-BAL-D|SAL|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|SAL|150-FOOD', 'B-BAL-D|SAL|150', '00-BAL-D|SAL|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|LIV|015-FOOD', 'B-BAL-D|LIV|015', '00-BAL-D|LIV|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|LIV|150-FOOD', 'B-BAL-D|LIV|150', '00-BAL-D|LIV|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|GOM|015-FOOD', 'B-BAL-D|GOM|015', '00-BAL-D|GOM|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|GOM|150-FOOD', 'B-BAL-D|GOM|150', '00-BAL-D|GOM|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|BEF|015-FOOD', 'B-BAL-D|BEF|015', '00-BAL-D|BEF|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|BEF|150-FOOD', 'B-BAL-D|BEF|150', '00-BAL-D|BEF|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|DCK|015-FOOD', 'B-BAL-D|DCK|015', '00-BAL-D|DCK|015', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAL-D|DCK|150-FOOD', 'B-BAL-D|DCK|150', '00-BAL-D|DCK|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- =====================================================
-- PART 2: Buzz Balanced+ Series (20kg bulk food material)
-- =====================================================

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BAP-C|HNS|010-FOOD', 'B-BAP-C|HNS|010', '00-BAP-C|HNS|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|HNS|030-FOOD', 'B-BAP-C|HNS|030', '00-BAP-C|HNS|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|IND|010-FOOD', 'B-BAP-C|IND|010', '00-BAP-C|IND|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|IND|030-FOOD', 'B-BAP-C|IND|030', '00-BAP-C|IND|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|WEP|010-FOOD', 'B-BAP-C|WEP|010', '00-BAP-C|WEP|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|WEP|030-FOOD', 'B-BAP-C|WEP|030', '00-BAP-C|WEP|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|KNP|010-FOOD', 'B-BAP-C|KNP|010', '00-BAP-C|KNP|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BAP-C|KNP|030-FOOD', 'B-BAP-C|KNP|030', '00-BAP-C|KNP|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');


-- =====================================================
-- PART 3: Buzz Beyond Series (20kg bulk food material)
-- =====================================================

-- Beyond Cat
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BEY-C|MNB|010-FOOD', 'B-BEY-C|MNB|010', '00-BEY-C|MNB|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|MNB|070-FOOD', 'B-BEY-C|MNB|070', '00-BEY-C|MNB|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|LAM|010-FOOD', 'B-BEY-C|LAM|010', '00-BEY-C|LAM|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|LAM|070-FOOD', 'B-BEY-C|LAM|070', '00-BEY-C|LAM|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|SAL|010-FOOD', 'B-BEY-C|SAL|010', '00-BEY-C|SAL|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|SAL|070-FOOD', 'B-BEY-C|SAL|070', '00-BEY-C|SAL|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|TUN|010-FOOD', 'B-BEY-C|TUN|010', '00-BEY-C|TUN|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|TUN|070-FOOD', 'B-BEY-C|TUN|070', '00-BEY-C|TUN|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|MCK|010-FOOD', 'B-BEY-C|MCK|010', '00-BEY-C|MCK|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-C|MCK|070-FOOD', 'B-BEY-C|MCK|070', '00-BEY-C|MCK|20', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Beyond Dog
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-BEY-D|MNB|010-FOOD', 'B-BEY-D|MNB|010', '00-BEY-D|MNB|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|MNB|070-FOOD', 'B-BEY-D|MNB|070', '00-BEY-D|MNB|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|LAM|012-FOOD', 'B-BEY-D|LAM|012', '00-BEY-D|LAM|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|LAM|100-FOOD', 'B-BEY-D|LAM|100', '00-BEY-D|LAM|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|CNL|012-FOOD', 'B-BEY-D|CNL|012', '00-BEY-D|CNL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|CNL|100-FOOD', 'B-BEY-D|CNL|100', '00-BEY-D|CNL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|SAL|012-FOOD', 'B-BEY-D|SAL|012', '00-BEY-D|SAL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|SAL|100-FOOD', 'B-BEY-D|SAL|100', '00-BEY-D|SAL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|BEF|012-FOOD', 'B-BEY-D|BEF|012', '00-BEY-D|BEF|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-BEY-D|BEF|100-FOOD', 'B-BEY-D|BEF|100', '00-BEY-D|BEF|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- =====================================================
-- PART 4: Buzz Netura Series (20kg bulk food material)
-- =====================================================

-- Netura Cat
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-NET-C|SAL|010-FOOD', 'B-NET-C|SAL|010', '00-NET-C|SAL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|SAL|040-FOOD', 'B-NET-C|SAL|040', '00-NET-C|SAL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|SAL|200-FOOD', 'B-NET-C|SAL|200', '00-NET-C|SAL|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FHC|010-FOOD', 'B-NET-C|FHC|010', '00-NET-C|FHC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FHC|040-FOOD', 'B-NET-C|FHC|040', '00-NET-C|FHC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FHC|200-FOOD', 'B-NET-C|FHC|200', '00-NET-C|FHC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FNC|010-FOOD', 'B-NET-C|FNC|010', '00-NET-C|FNC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FNC|040-FOOD', 'B-NET-C|FNC|040', '00-NET-C|FNC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|FNC|200-FOOD', 'B-NET-C|FNC|200', '00-NET-C|FNC|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|CNT|010-FOOD', 'B-NET-C|CNT|010', '00-NET-C|CNT|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-C|CNT|040-FOOD', 'B-NET-C|CNT|040', '00-NET-C|CNT|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Netura Dog
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-NET-D|CHI-S|008-FOOD', 'B-NET-D|CHI-S|008', '00-NET-D|CHI-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-S|025-FOOD', 'B-NET-D|CHI-S|025', '00-NET-D|CHI-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-S|200-FOOD', 'B-NET-D|CHI-S|200', '00-NET-D|CHI-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-L|008-FOOD', 'B-NET-D|CHI-L|008', '00-NET-D|CHI-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-L|025-FOOD', 'B-NET-D|CHI-L|025', '00-NET-D|CHI-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-L|100-FOOD', 'B-NET-D|CHI-L|100', '00-NET-D|CHI-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|CHI-L|200-FOOD', 'B-NET-D|CHI-L|200', '00-NET-D|CHI-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-S|008-FOOD', 'B-NET-D|SAL-S|008', '00-NET-D|SAL-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-S|025-FOOD', 'B-NET-D|SAL-S|025', '00-NET-D|SAL-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-S|200-FOOD', 'B-NET-D|SAL-S|200', '00-NET-D|SAL-S|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-L|008-FOOD', 'B-NET-D|SAL-L|008', '00-NET-D|SAL-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-L|025-FOOD', 'B-NET-D|SAL-L|025', '00-NET-D|SAL-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-L|100-FOOD', 'B-NET-D|SAL-L|100', '00-NET-D|SAL-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NET-D|SAL-L|200-FOOD', 'B-NET-D|SAL-L|200', '00-NET-D|SAL-L|200', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- =====================================================
-- PART 5: Buzz Netura+ Series (15kg bulk food material)
-- =====================================================

-- Netura+ Puppy
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-NEP-D|PUP-S|005-FOOD', 'B-NEP-D|PUP-S|005', '00-NEP-D|PUP-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|PUP-S|030-FOOD', 'B-NEP-D|PUP-S|030', '00-NEP-D|PUP-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|PUP-L|005-FOOD', 'B-NEP-D|PUP-L|005', '00-NEP-D|PUP-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|PUP-L|030-FOOD', 'B-NEP-D|PUP-L|030', '00-NEP-D|PUP-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Netura+ Adult Skin
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-NEP-D|SKN-S|005-FOOD', 'B-NEP-D|SKN-S|005', '00-NEP-D|SKN-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-S|012-FOOD', 'B-NEP-D|SKN-S|012', '00-NEP-D|SKN-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-S|030-FOOD', 'B-NEP-D|SKN-S|030', '00-NEP-D|SKN-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-S|150-FOOD', 'B-NEP-D|SKN-S|150', '00-NEP-D|SKN-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-L|005-FOOD', 'B-NEP-D|SKN-L|005', '00-NEP-D|SKN-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-L|012-FOOD', 'B-NEP-D|SKN-L|012', '00-NEP-D|SKN-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-L|030-FOOD', 'B-NEP-D|SKN-L|030', '00-NEP-D|SKN-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|SKN-L|150-FOOD', 'B-NEP-D|SKN-L|150', '00-NEP-D|SKN-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

-- Netura+ Adult Joint
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status)
VALUES
  ('BOM-B-NEP-D|HEJ-S|005-FOOD', 'B-NEP-D|HEJ-S|005', '00-NEP-D|HEJ-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-S|012-FOOD', 'B-NEP-D|HEJ-S|012', '00-NEP-D|HEJ-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-S|030-FOOD', 'B-NEP-D|HEJ-S|030', '00-NEP-D|HEJ-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-S|150-FOOD', 'B-NEP-D|HEJ-S|150', '00-NEP-D|HEJ-S|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-L|005-FOOD', 'B-NEP-D|HEJ-L|005', '00-NEP-D|HEJ-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-L|012-FOOD', 'B-NEP-D|HEJ-L|012', '00-NEP-D|HEJ-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-L|030-FOOD', 'B-NEP-D|HEJ-L|030', '00-NEP-D|HEJ-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active'),
  ('BOM-B-NEP-D|HEJ-L|150-FOOD', 'B-NEP-D|HEJ-L|150', '00-NEP-D|HEJ-L|150', 1, 'ถุง', 1, 'วัตถุดิบอาหาร', 'active');

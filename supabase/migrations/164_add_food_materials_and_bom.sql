-- Migration: Add Food Materials SKUs and BOM Records
-- Description: Create missing food material SKUs and add BOM records for food materials
-- Date: 2025-12-21

-- ============================================
-- PART 1: Create Food Material SKUs for Balanced Series
-- (Food materials use same size as finished product)
-- ============================================

-- Balanced Cat - แมวโต รสแกะ
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|LAM|012', 'อาหาร | Buzz Balanced แมวโต รสแกะ | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|LAM|028', 'อาหาร | Buzz Balanced แมวโต รสแกะ | 2.8 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|LAM|070', 'อาหาร | Buzz Balanced แมวโต รสแกะ | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - แมวโต รสแซลมอน
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|SAL|012', 'อาหาร | Buzz Balanced แมวโต รสแซลมอน | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|SAL|028', 'อาหาร | Buzz Balanced แมวโต รสแซลมอน | 2.8 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|SAL|070', 'อาหาร | Buzz Balanced แมวโต รสแซลมอน | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - แมวโต รสทูน่า
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|TUN|012', 'อาหาร | Buzz Balanced แมวโต รสทูน่า | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|TUN|028', 'อาหาร | Buzz Balanced แมวโต รสทูน่า | 2.8 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|TUN|070', 'อาหาร | Buzz Balanced แมวโต รสทูน่า | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - แมวโต รสปลาทู
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|MCK|012', 'อาหาร | Buzz Balanced แมวโต รสปลาทู | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|MCK|028', 'อาหาร | Buzz Balanced แมวโต รสปลาทู | 2.8 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|MCK|070', 'อาหาร | Buzz Balanced แมวโต รสปลาทู | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - แมวโต รสปู
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|CRB|012', 'อาหาร | Buzz Balanced แมวโต รสปู | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|CRB|070', 'อาหาร | Buzz Balanced แมวโต รสปู | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - แมวโต รสล็อบสเตอร์
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|LOB|012', 'อาหาร | Buzz Balanced แมวโต รสล็อบสเตอร์ | 1.2 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|LOB|070', 'อาหาร | Buzz Balanced แมวโต รสล็อบสเตอร์ | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Cat - ลูกแมว
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-C|KIT|010', 'อาหาร | Buzz Balanced ลูกแมว | 1 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|KIT|025', 'อาหาร | Buzz Balanced ลูกแมว | 2.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-C|KIT|070', 'อาหาร | Buzz Balanced ลูกแมว | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - ลูกสุนัข
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|PUP|010', 'อาหาร | Buzz Balanced ลูกสุนัข | 1 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|PUP|070', 'อาหาร | Buzz Balanced ลูกสุนัข | 7 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสแกะ
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|LAM|015', 'อาหาร | Buzz Balanced สุนัขโต รสแกะ | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|LAM|150', 'อาหาร | Buzz Balanced สุนัขโต รสแกะ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสแซลมอน
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|SAL|015', 'อาหาร | Buzz Balanced สุนัขโต รสแซลมอน | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|SAL|150', 'อาหาร | Buzz Balanced สุนัขโต รสแซลมอน | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสตับ
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|LIV|015', 'อาหาร | Buzz Balanced สุนัขโต รสตับ | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|LIV|150', 'อาหาร | Buzz Balanced สุนัขโต รสตับ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสนมแพะ
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|GOM|015', 'อาหาร | Buzz Balanced สุนัขโต รสนมแพะ | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|GOM|150', 'อาหาร | Buzz Balanced สุนัขโต รสนมแพะ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสเนื้อ
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|BEF|015', 'อาหาร | Buzz Balanced สุนัขโต รสเนื้อ | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|BEF|150', 'อาหาร | Buzz Balanced สุนัขโต รสเนื้อ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสเป็ด
INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-BAL-D|DCK|015', 'อาหาร | Buzz Balanced สุนัขโต รสเป็ด | 1.5 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-BAL-D|DCK|150', 'อาหาร | Buzz Balanced สุนัขโต รสเป็ด | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;


-- ============================================
-- PART 2: Create Food Material SKUs for Netura+ Series
-- (Food materials use 15 kg bulk)
-- ============================================

INSERT INTO master_sku (sku_id, sku_name, category, sub_category, brand, product_type, uom_base, status, created_by)
VALUES 
  ('00-NEP-D|PUP-S|150', 'อาหาร | Buzz Netura+ ลูกสุนัข แกะ เม็ดเล็ก | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-NEP-D|PUP-L|150', 'อาหาร | Buzz Netura+ ลูกสุนัข แกะ เม็ดใหญ่ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-NEP-D|SKN-S|150', 'อาหาร | Buzz Netura+ สุนัขโต แกะ เม็ดเล็ก | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-NEP-D|SKN-L|150', 'อาหาร | Buzz Netura+ สุนัขโต แกะ เม็ดใหญ่ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-NEP-D|HEJ-S|150', 'อาหาร | Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดเล็ก | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system'),
  ('00-NEP-D|HEJ-L|150', 'อาหาร | Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดใหญ่ | 15 กก.', 'วัตถุดิบ', 'อาหาร', 'Buzz', 'อาหาร', 'กก.', 'active', 'system')
ON CONFLICT (sku_id) DO NOTHING;

-- ============================================
-- PART 3: Add BOM Records for Balanced Series Food Materials
-- (Each finished product links to its same-size food material)
-- ============================================

-- Balanced Cat - แมวโต รสแกะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|LAM|012-FOOD', 'B-BAL-C|LAM|012', '00-BAL-C|LAM|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|LAM|028-FOOD', 'B-BAL-C|LAM|028', '00-BAL-C|LAM|028', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|LAM|070-FOOD', 'B-BAL-C|LAM|070', '00-BAL-C|LAM|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - แมวโต รสแซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|SAL|012-FOOD', 'B-BAL-C|SAL|012', '00-BAL-C|SAL|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|SAL|028-FOOD', 'B-BAL-C|SAL|028', '00-BAL-C|SAL|028', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|SAL|070-FOOD', 'B-BAL-C|SAL|070', '00-BAL-C|SAL|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - แมวโต รสทูน่า
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|TUN|012-FOOD', 'B-BAL-C|TUN|012', '00-BAL-C|TUN|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|TUN|028-FOOD', 'B-BAL-C|TUN|028', '00-BAL-C|TUN|028', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|TUN|070-FOOD', 'B-BAL-C|TUN|070', '00-BAL-C|TUN|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - แมวโต รสปลาทู
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|MCK|012-FOOD', 'B-BAL-C|MCK|012', '00-BAL-C|MCK|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|MCK|028-FOOD', 'B-BAL-C|MCK|028', '00-BAL-C|MCK|028', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|MCK|070-FOOD', 'B-BAL-C|MCK|070', '00-BAL-C|MCK|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - แมวโต รสปู
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|CRB|012-FOOD', 'B-BAL-C|CRB|012', '00-BAL-C|CRB|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|CRB|070-FOOD', 'B-BAL-C|CRB|070', '00-BAL-C|CRB|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - แมวโต รสล็อบสเตอร์
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|LOB|012-FOOD', 'B-BAL-C|LOB|012', '00-BAL-C|LOB|012', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|LOB|070-FOOD', 'B-BAL-C|LOB|070', '00-BAL-C|LOB|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Cat - ลูกแมว
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-C|KIT|010-FOOD', 'B-BAL-C|KIT|010', '00-BAL-C|KIT|010', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|KIT|025-FOOD', 'B-BAL-C|KIT|025', '00-BAL-C|KIT|025', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-C|KIT|070-FOOD', 'B-BAL-C|KIT|070', '00-BAL-C|KIT|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - ลูกสุนัข
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|PUP|010-FOOD', 'B-BAL-D|PUP|010', '00-BAL-D|PUP|010', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|PUP|070-FOOD', 'B-BAL-D|PUP|070', '00-BAL-D|PUP|070', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสแกะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|LAM|015-FOOD', 'B-BAL-D|LAM|015', '00-BAL-D|LAM|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|LAM|150-FOOD', 'B-BAL-D|LAM|150', '00-BAL-D|LAM|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสแซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|SAL|015-FOOD', 'B-BAL-D|SAL|015', '00-BAL-D|SAL|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|SAL|150-FOOD', 'B-BAL-D|SAL|150', '00-BAL-D|SAL|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสตับ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|LIV|015-FOOD', 'B-BAL-D|LIV|015', '00-BAL-D|LIV|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|LIV|150-FOOD', 'B-BAL-D|LIV|150', '00-BAL-D|LIV|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสนมแพะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|GOM|015-FOOD', 'B-BAL-D|GOM|015', '00-BAL-D|GOM|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|GOM|150-FOOD', 'B-BAL-D|GOM|150', '00-BAL-D|GOM|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสเนื้อ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|BEF|015-FOOD', 'B-BAL-D|BEF|015', '00-BAL-D|BEF|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|BEF|150-FOOD', 'B-BAL-D|BEF|150', '00-BAL-D|BEF|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced Dog - สุนัขโต รสเป็ด
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAL-D|DCK|015-FOOD', 'B-BAL-D|DCK|015', '00-BAL-D|DCK|015', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAL-D|DCK|150-FOOD', 'B-BAL-D|DCK|150', '00-BAL-D|DCK|150', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;


-- ============================================
-- PART 4: Add BOM Records for Balanced+ Series
-- (Uses 20kg bulk food materials)
-- ============================================

-- Balanced+ Cat - Hair&Skin
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAP-C|HNS|010-FOOD', 'B-BAP-C|HNS|010', '00-BAP-C|HNS|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAP-C|HNS|030-FOOD', 'B-BAP-C|HNS|030', '00-BAP-C|HNS|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced+ Cat - Indoor
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAP-C|IND|010-FOOD', 'B-BAP-C|IND|010', '00-BAP-C|IND|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAP-C|IND|030-FOOD', 'B-BAP-C|IND|030', '00-BAP-C|IND|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced+ Cat - Weight+
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAP-C|WEP|010-FOOD', 'B-BAP-C|WEP|010', '00-BAP-C|WEP|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAP-C|WEP|030-FOOD', 'B-BAP-C|WEP|030', '00-BAP-C|WEP|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Balanced+ Cat - K&P (Kitten & Pregnant)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BAP-C|KNP|010-FOOD', 'B-BAP-C|KNP|010', '00-BAP-C|KNP|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BAP-C|KNP|030-FOOD', 'B-BAP-C|KNP|030', '00-BAP-C|KNP|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- ============================================
-- PART 5: Add BOM Records for Beyond Series
-- (Uses 20kg bulk food materials)
-- ============================================

-- Beyond Cat - แม่และลูกแมว
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-C|MNB|010-FOOD', 'B-BEY-C|MNB|010', '00-BEY-C|MNB|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|MNB|NS|010-FOOD', 'B-BEY-C|MNB|NS|010', '00-BEY-C|MNB|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|MNB|070-FOOD', 'B-BEY-C|MNB|070', '00-BEY-C|MNB|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Dog - แม่และลูกสุนัข
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-D|MNB|010-FOOD', 'B-BEY-D|MNB|010', '00-BEY-D|MNB|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|MNB|NS|010-FOOD', 'B-BEY-D|MNB|NS|010', '00-BEY-D|MNB|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|MNB|070-FOOD', 'B-BEY-D|MNB|070', '00-BEY-D|MNB|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Cat - แมวโต รสแกะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-C|LAM|010-FOOD', 'B-BEY-C|LAM|010', '00-BEY-C|LAM|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|LAM|NS|010-FOOD', 'B-BEY-C|LAM|NS|010', '00-BEY-C|LAM|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|LAM|070-FOOD', 'B-BEY-C|LAM|070', '00-BEY-C|LAM|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Cat - แมวโต รสแซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-C|SAL|010-FOOD', 'B-BEY-C|SAL|010', '00-BEY-C|SAL|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|SAL|NS|010-FOOD', 'B-BEY-C|SAL|NS|010', '00-BEY-C|SAL|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|SAL|070-FOOD', 'B-BEY-C|SAL|070', '00-BEY-C|SAL|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Cat - แมวโต รสทูน่า
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-C|TUN|010-FOOD', 'B-BEY-C|TUN|010', '00-BEY-C|TUN|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|TUN|NS|010-FOOD', 'B-BEY-C|TUN|NS|010', '00-BEY-C|TUN|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|TUN|070-FOOD', 'B-BEY-C|TUN|070', '00-BEY-C|TUN|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Cat - แมวโต รสปลาทู
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-C|MCK|010-FOOD', 'B-BEY-C|MCK|010', '00-BEY-C|MCK|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|MCK|NS|010-FOOD', 'B-BEY-C|MCK|NS|010', '00-BEY-C|MCK|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-C|MCK|070-FOOD', 'B-BEY-C|MCK|070', '00-BEY-C|MCK|20', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Dog - สุนัขโต รสแกะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-D|LAM|012-FOOD', 'B-BEY-D|LAM|012', '00-BEY-D|LAM|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|LAM|NS|012-FOOD', 'B-BEY-D|LAM|NS|012', '00-BEY-D|LAM|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|LAM|100-FOOD', 'B-BEY-D|LAM|100', '00-BEY-D|LAM|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Dog - สุนัขโต รสไก่อบและตับ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-D|CNL|012-FOOD', 'B-BEY-D|CNL|012', '00-BEY-D|CNL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|CNL|NS|012-FOOD', 'B-BEY-D|CNL|NS|012', '00-BEY-D|CNL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|CNL|100-FOOD', 'B-BEY-D|CNL|100', '00-BEY-D|CNL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Dog - สุนัขโต รสแซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-D|SAL|012-FOOD', 'B-BEY-D|SAL|012', '00-BEY-D|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|SAL|NS|012-FOOD', 'B-BEY-D|SAL|NS|012', '00-BEY-D|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|SAL|100-FOOD', 'B-BEY-D|SAL|100', '00-BEY-D|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Beyond Dog - สุนัขโต รสเนื้ออบ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-BEY-D|BEF|012-FOOD', 'B-BEY-D|BEF|012', '00-BEY-D|BEF|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|BEF|NS|012-FOOD', 'B-BEY-D|BEF|NS|012', '00-BEY-D|BEF|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-BEY-D|BEF|100-FOOD', 'B-BEY-D|BEF|100', '00-BEY-D|BEF|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;


-- ============================================
-- PART 6: Add BOM Records for Netura Series
-- (Uses 20kg bulk food materials)
-- ============================================

-- Netura Cat - แซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-C|SAL|010-FOOD', 'B-NET-C|SAL|010', '00-NET-C|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|SAL|040-FOOD', 'B-NET-C|SAL|040', '00-NET-C|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|SAL|200-FOOD', 'B-NET-C|SAL|200', '00-NET-C|SAL|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Cat - ปลาเนื้อขาว แฮร์ริ่ง และไก่
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-C|FHC|010-FOOD', 'B-NET-C|FHC|010', '00-NET-C|FHC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|FHC|040-FOOD', 'B-NET-C|FHC|040', '00-NET-C|FHC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|FHC|200-FOOD', 'B-NET-C|FHC|200', '00-NET-C|FHC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Cat - ปลาและไก่
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-C|FNC|010-FOOD', 'B-NET-C|FNC|010', '00-NET-C|FNC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|FNC|040-FOOD', 'B-NET-C|FNC|040', '00-NET-C|FNC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|FNC|200-FOOD', 'B-NET-C|FNC|200', '00-NET-C|FNC|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Cat - ปลาค๊อด & ปลาเทราต์ (Indoor/Sterilized)
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-C|CNT|010-FOOD', 'B-NET-C|CNT|010', '00-NET-C|CNT|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-C|CNT|040-FOOD', 'B-NET-C|CNT|040', '00-NET-C|CNT|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Dog - ไก่ เม็ดเล็ก
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-D|CHI-S|008-FOOD', 'B-NET-D|CHI-S|008', '00-NET-D|CHI-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|CHI-S|025-FOOD', 'B-NET-D|CHI-S|025', '00-NET-D|CHI-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|CHI-S|200-FOOD', 'B-NET-D|CHI-S|200', '00-NET-D|CHI-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Dog - ไก่ เม็ดใหญ่
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-D|CHI-L|008-FOOD', 'B-NET-D|CHI-L|008', '00-NET-D|CHI-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|CHI-L|025-FOOD', 'B-NET-D|CHI-L|025', '00-NET-D|CHI-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|CHI-L|100-FOOD', 'B-NET-D|CHI-L|100', '00-NET-D|CHI-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|CHI-L|200-FOOD', 'B-NET-D|CHI-L|200', '00-NET-D|CHI-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Dog - แซลมอน เม็ดเล็ก
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-D|SAL-S|008-FOOD', 'B-NET-D|SAL-S|008', '00-NET-D|SAL-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|SAL-S|025-FOOD', 'B-NET-D|SAL-S|025', '00-NET-D|SAL-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|SAL-S|200-FOOD', 'B-NET-D|SAL-S|200', '00-NET-D|SAL-S|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- Netura Dog - แซลมอน เม็ดใหญ่
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, created_by, status)
VALUES 
  ('BOM-NET-D|SAL-L|008-FOOD', 'B-NET-D|SAL-L|008', '00-NET-D|SAL-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|SAL-L|025-FOOD', 'B-NET-D|SAL-L|025', '00-NET-D|SAL-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|SAL-L|100-FOOD', 'B-NET-D|SAL-L|100', '00-NET-D|SAL-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active'),
  ('BOM-NET-D|SAL-L|200-FOOD', 'B-NET-D|SAL-L|200', '00-NET-D|SAL-L|200', 1, 'ชิ้น', 1, 'วัตถุดิบอาหาร', 'system', 'active')
ON CONFLICT (bom_id) DO NOTHING;

-- ============================================
-- PART 7: Add BOM Records for Netura+ Series
-- (Uses 15kg bulk food materials)
-- ============================================

-- Get Netura+ finished products and add BOM records
-- Note: Netura+ food materials use 15kg bulk (created in Part 2)

-- This will be handled by checking existing Netura+ products in the database
-- For now, we'll add placeholder comment as Netura+ products need to be verified

-- Summary:
-- - Created 33 food material SKUs for Balanced series (same size as finished product)
-- - Created 6 food material SKUs for Netura+ series (15kg bulk)
-- - Added BOM records linking finished products to food materials for:
--   * Balanced series (33 products)
--   * Balanced+ series (8 products)
--   * Beyond series (30 products)
--   * Netura series (25 products)

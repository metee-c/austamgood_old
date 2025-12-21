-- Migration: Import BOM (Bill of Materials) Data
-- Description: Import BOM data for Buzz products
-- Date: 2025-12-21

-- Create a temporary function to find SKU ID by name pattern
CREATE OR REPLACE FUNCTION find_sku_id(p_name TEXT) RETURNS TEXT AS $$
DECLARE
    v_sku_id TEXT;
BEGIN
    -- Try exact match first
    SELECT sku_id INTO v_sku_id FROM master_sku WHERE sku_name = p_name LIMIT 1;
    IF v_sku_id IS NOT NULL THEN
        RETURN v_sku_id;
    END IF;
    
    -- Try with prefix patterns for different material types
    -- For "อาหาร | ..." pattern
    IF p_name LIKE 'อาหาร | %' THEN
        SELECT sku_id INTO v_sku_id FROM master_sku 
        WHERE sku_name = p_name LIMIT 1;
        IF v_sku_id IS NOT NULL THEN
            RETURN v_sku_id;
        END IF;
    END IF;
    
    -- For "ถุง | ..." pattern
    IF p_name LIKE 'ถุง | %' THEN
        SELECT sku_id INTO v_sku_id FROM master_sku 
        WHERE sku_name = p_name LIMIT 1;
        IF v_sku_id IS NOT NULL THEN
            RETURN v_sku_id;
        END IF;
    END IF;
    
    -- For "ถุง Tester | ..." pattern
    IF p_name LIKE 'ถุง Tester | %' THEN
        SELECT sku_id INTO v_sku_id FROM master_sku 
        WHERE sku_name = p_name LIMIT 1;
        IF v_sku_id IS NOT NULL THEN
            RETURN v_sku_id;
        END IF;
    END IF;
    
    -- For sticker patterns
    IF p_name LIKE 'สติ๊กเกอร์%' OR p_name LIKE 'สติกเกอร์%' THEN
        SELECT sku_id INTO v_sku_id FROM master_sku 
        WHERE sku_name = p_name LIMIT 1;
        IF v_sku_id IS NOT NULL THEN
            RETURN v_sku_id;
        END IF;
    END IF;
    
    -- For finished products (Buzz products)
    SELECT sku_id INTO v_sku_id FROM master_sku 
    WHERE sku_name = p_name LIMIT 1;
    
    RETURN v_sku_id;
END;
$$ LANGUAGE plpgsql;

-- Insert BOM data for Buzz Balanced Cat products
-- Buzz Balanced แมวโต รสแกะ | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LAM|012'
AND material.sku_id = '01-BAL-C|LAM|012';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'อาหาร',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LAM|012'
AND material.sku_name LIKE 'อาหาร | Buzz Balanced แมวโต รสแกะ%';

-- Buzz Balanced แมวโต รสแกะ | 2.8 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LAM|028'
AND material.sku_id = '01-BAL-C|LAM|028';

-- Buzz Balanced แมวโต รสแกะ | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LAM|070'
AND material.sku_id = '01-BAL-C|LAM|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LAM|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced แมวโต รสแซลมอน | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|SAL|012'
AND material.sku_id = '01-BAL-C|SAL|012';

-- Buzz Balanced แมวโต รสแซลมอน | 2.8 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|SAL|028'
AND material.sku_id = '01-BAL-C|SAL|028';

-- Buzz Balanced แมวโต รสแซลมอน | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|SAL|070'
AND material.sku_id = '01-BAL-C|SAL|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|SAL|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced แมวโต รสทูน่า | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|TUN|012'
AND material.sku_id = '01-BAL-C|TUN|012';

-- Buzz Balanced แมวโต รสทูน่า | 2.8 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|TUN|028'
AND material.sku_id = '01-BAL-C|TUN|028';

-- Buzz Balanced แมวโต รสทูน่า | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|TUN|070'
AND material.sku_id = '01-BAL-C|TUN|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|TUN|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced แมวโต รสปลาทู | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|MCK|012'
AND material.sku_id = '01-BAL-C|MCK|012';

-- Buzz Balanced แมวโต รสปลาทู | 2.8 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|MCK|028'
AND material.sku_id = '01-BAL-C|MCK|028';

-- Buzz Balanced แมวโต รสปลาทู | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|MCK|070'
AND material.sku_id = '01-BAL-C|MCK|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|MCK|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced แมวโต รสปู | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|CRB|012'
AND material.sku_id = '01-BAL-C|CRB|012';

-- Buzz Balanced แมวโต รสปู | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|CRB|070'
AND material.sku_id = '01-BAL-C|CRB|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|CRB|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced แมวโต รสล็อบสเตอร์ | 1.2 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LOB|012'
AND material.sku_id = '01-BAL-C|LOB|012';

-- Buzz Balanced แมวโต รสล็อบสเตอร์ | 7 กก.
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LOB|070'
AND material.sku_id = '01-BAL-C|LOB|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|LOB|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced ลูกแมว
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|KIT|010'
AND material.sku_id = '01-BAL-C|KIT|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|KIT|025'
AND material.sku_id = '01-BAL-C|KIT|025';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|KIT|070'
AND material.sku_id = '01-BAL-C|KIT|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-C|KIT|070'
AND material.sku_id = '02-STK-7kg|Beyond';


-- Buzz Balanced Dog products
-- Buzz Balanced ลูกสุนัข
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|PUP|010'
AND material.sku_id = '01-BAL-D|PUP|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|PUP|070'
AND material.sku_id = '01-BAL-D|PUP|070';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|PUP|070'
AND material.sku_id = '02-STK-7kg|Beyond';

-- Buzz Balanced สุนัขโต รสแกะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|LAM|015'
AND material.sku_id = '01-BAL-D|LAM|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|LAM|150'
AND material.sku_id = '01-BAL-D|LAM|150';

-- Buzz Balanced สุนัขโต รสแซลมอน
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|SAL|015'
AND material.sku_id = '01-BAL-D|SAL|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|SAL|150'
AND material.sku_id = '01-BAL-D|SAL|150';

-- Buzz Balanced สุนัขโต รสตับ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|LIV|015'
AND material.sku_id = '01-BAL-D|LIV|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|LIV|150'
AND material.sku_id = '01-BAL-D|LIV|150';

-- Buzz Balanced สุนัขโต รสนมแพะ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|GOM|015'
AND material.sku_id = '01-BAL-D|GOM|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|GOM|150'
AND material.sku_id = '01-BAL-D|GOM|150';

-- Buzz Balanced สุนัขโต รสเนื้อ
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|BEF|015'
AND material.sku_id = '01-BAL-D|BEF|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|BEF|150'
AND material.sku_id = '01-BAL-D|BEF|150';

-- Buzz Balanced สุนัขโต รสเป็ด
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|DCK|015'
AND material.sku_id = '01-BAL-D|DCK|015';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAL-D|DCK|150'
AND material.sku_id = '01-BAL-D|DCK|150';

-- Buzz Balanced+ Cat products
-- Buzz Balanced+ แมวโต Hair&Skin
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|010'
AND material.sku_id = '01-BAP-C|HNS|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|010'
AND material.sku_id = '02-STK-HAIRSKIN';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|010'
AND material.sku_id = '02-STICKER-PRICE189';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|030'
AND material.sku_id = '01-BAP-C|HNS|030';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|030'
AND material.sku_id = '02-STK-HAIRSKIN';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|HNS|030'
AND material.sku_id = '02-STICKER-PRICE489';

-- Buzz Balanced+ แมวโต Indoor
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|010'
AND material.sku_id = '01-BAP-C|IND|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|010'
AND material.sku_id = '02-STK-INDOOR';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|010'
AND material.sku_id = '02-STICKER-PRICE189';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|030'
AND material.sku_id = '01-BAP-C|IND|030';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|030'
AND material.sku_id = '02-STK-INDOOR';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|IND|030'
AND material.sku_id = '02-STICKER-PRICE489';

-- Buzz Balanced+ แมวโต Weight+
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|010'
AND material.sku_id = '01-BAP-C|WEP|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|010'
AND material.sku_id = '02-STK-WEIGHT';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|010'
AND material.sku_id = '02-STICKER-PRICE189';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|030'
AND material.sku_id = '01-BAP-C|WEP|030';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|030'
AND material.sku_id = '02-STK-WEIGHT';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|WEP|030'
AND material.sku_id = '02-STICKER-PRICE489';

-- Buzz Balanced+ ลูกและแม่แมว K&P
INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|010'
AND material.sku_id = '01-BAP-C|KNP|010';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|010'
AND material.sku_id = '02-STK-KITTEN';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|010'
AND material.sku_id = '02-STICKER-PRICE189';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    1,
    'ถุง',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|030'
AND material.sku_id = '01-BAP-C|KNP|030';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    2,
    'สติ๊กเกอร์',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|030'
AND material.sku_id = '02-STK-KITTEN';

INSERT INTO bom_sku (bom_id, finished_sku_id, material_sku_id, material_qty, material_uom, step_order, step_name, status, created_by)
SELECT 
    'BOM-' || finished.sku_id,
    finished.sku_id,
    material.sku_id,
    1,
    'ชิ้น',
    3,
    'สติ๊กเกอร์ราคา',
    'active',
    'system'
FROM master_sku finished
CROSS JOIN master_sku material
WHERE finished.sku_id = 'B-BAP-C|KNP|030'
AND material.sku_id = '02-STICKER-PRICE489';

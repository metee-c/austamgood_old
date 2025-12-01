-- Fix face_sheet_items to populate sku_id from product_code
-- This ensures stock reservation trigger can work properly

-- Step 1: Update existing face_sheet_items to populate sku_id from product_code
UPDATE face_sheet_items
SET sku_id = product_code
WHERE sku_id IS NULL AND product_code IS NOT NULL;

-- Step 2: Patch the INSERT statement in create_face_sheet_packages function
-- We need to modify only the INSERT INTO face_sheet_items section
DO $$
DECLARE
    func_body TEXT;
BEGIN
    -- Get the current function body
    SELECT pg_get_functiondef(oid) INTO func_body
    FROM pg_proc
    WHERE proname = 'create_face_sheet_packages';
    
    -- Replace the INSERT INTO face_sheet_items section
    func_body := REPLACE(
        func_body,
        E'INSERT INTO face_sheet_items (\n            face_sheet_id,\n            package_id,\n            order_id,\n            order_item_id,\n            product_code,\n            product_name,\n            size,\n            quantity,\n            weight\n        )\n        SELECT\n            v_face_sheet_id,\n            v_inserted_package_id,\n            t.order_id,\n            t.order_item_id,\n            t.product_code,\n            t.product_name,\n            t.size,\n            t.quantity,\n            COALESCE(NULLIF(t.size, \'\')::NUMERIC, 0) * t.quantity',
        E'INSERT INTO face_sheet_items (\n            face_sheet_id,\n            package_id,\n            order_id,\n            order_item_id,\n            sku_id,\n            product_code,\n            product_name,\n            size,\n            quantity,\n            weight\n        )\n        SELECT\n            v_face_sheet_id,\n            v_inserted_package_id,\n            t.order_id,\n            t.order_item_id,\n            t.product_code,\n            t.product_code,\n            t.product_name,\n            t.size,\n            t.quantity,\n            COALESCE(NULLIF(t.size, \'\')::NUMERIC, 0) * t.quantity'
    );
    
    -- Execute the modified function
    EXECUTE func_body;
END $$;

-- Update existing face_sheet_items to populate sku_id from product_code
UPDATE face_sheet_items
SET sku_id = product_code
WHERE sku_id IS NULL AND product_code IS NOT NULL;

COMMENT ON COLUMN face_sheet_items.sku_id IS 'SKU ID for stock reservation - populated from product_code';

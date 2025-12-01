-- Add trigger to automatically populate sku_id from product_code in face_sheet_items
-- This ensures sku_id is always set for stock reservation

-- Create trigger function to populate sku_id
CREATE OR REPLACE FUNCTION populate_face_sheet_item_sku_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If sku_id is null but product_code exists, copy product_code to sku_id
    IF NEW.sku_id IS NULL AND NEW.product_code IS NOT NULL THEN
        NEW.sku_id := NEW.product_code;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_populate_sku_id ON face_sheet_items;

-- Create trigger BEFORE INSERT to populate sku_id
CREATE TRIGGER trigger_populate_sku_id
    BEFORE INSERT ON face_sheet_items
    FOR EACH ROW
    EXECUTE FUNCTION populate_face_sheet_item_sku_id();

-- Update existing records where sku_id is null
UPDATE face_sheet_items
SET sku_id = product_code
WHERE sku_id IS NULL AND product_code IS NOT NULL;

COMMENT ON FUNCTION populate_face_sheet_item_sku_id IS 'Automatically populate sku_id from product_code before insert';

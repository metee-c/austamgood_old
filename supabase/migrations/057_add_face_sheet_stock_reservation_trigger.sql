-- Migration: Add trigger to automatically reserve stock after face sheet items are created
-- This trigger calls reserve_stock_for_face_sheet_items function after face_sheet_items are inserted

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_reserve_stock_after_face_sheet_items_created ON face_sheet_items;

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_reserve_stock_after_face_sheet_created()
RETURNS TRIGGER AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Call the reservation function using NEW.id (not NEW.face_sheet_id)
  SELECT * INTO v_result
  FROM reserve_stock_for_face_sheet_items(
    NEW.id,  -- ใช้ NEW.id แทน NEW.face_sheet_id
    COALESCE(NEW.warehouse_id, 'WH01'),
    COALESCE(NEW.created_by, 'System')
  );
  
  -- Log the result
  IF v_result.success THEN
    RAISE NOTICE 'Stock reserved successfully for face_sheet_id: %, items: %', 
      NEW.id, v_result.items_reserved;
  ELSE
    RAISE WARNING 'Stock reservation failed for face_sheet_id: %, message: %, insufficient: %',
      NEW.id, v_result.message, v_result.insufficient_stock_items;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on face_sheets table (after insert)
-- This will be called once per face_sheet creation
CREATE TRIGGER trigger_reserve_stock_after_face_sheet_created
AFTER INSERT ON face_sheets
FOR EACH ROW
WHEN (NEW.status = 'generated')
EXECUTE FUNCTION trigger_reserve_stock_after_face_sheet_created();

COMMENT ON TRIGGER trigger_reserve_stock_after_face_sheet_created ON face_sheets IS 
'Automatically reserves stock for face sheet items after face sheet is created';

COMMENT ON FUNCTION trigger_reserve_stock_after_face_sheet_created() IS 
'Trigger function that calls reserve_stock_for_face_sheet_items to reserve inventory for face sheet items using FEFO/FIFO logic';

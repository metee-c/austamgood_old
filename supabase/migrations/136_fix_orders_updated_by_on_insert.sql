-- Migration: Fix orders updated_by to be set on INSERT
-- Description: Set updated_by = created_by when inserting new orders

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_set_wms_orders_created_by ON wms_orders;

-- Recreate function to set both created_by and updated_by on INSERT
CREATE OR REPLACE FUNCTION set_wms_orders_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ายังไม่มีค่า created_by ให้ดึงจาก session variable
  IF NEW.created_by IS NULL THEN
    BEGIN
      NEW.created_by := get_current_user_id();
    EXCEPTION
      WHEN OTHERS THEN
        -- ถ้าไม่มี user context ให้ใช้ค่า NULL
        NEW.created_by := NULL;
    END;
  END IF;
  
  -- ✅ FIX: ตั้งค่า updated_by = created_by ตอน INSERT
  -- เพราะการสร้างออเดอร์ใหม่ถือว่าเป็นทั้ง "สร้าง" และ "แก้ไข" ครั้งแรก
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_set_wms_orders_created_by
  BEFORE INSERT ON wms_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_wms_orders_created_by();

-- Comment
COMMENT ON FUNCTION set_wms_orders_created_by() IS 
'Set created_by and updated_by from session context on INSERT. 
updated_by is set to created_by on INSERT because creating an order is also the first modification.';

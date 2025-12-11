-- ============================================================================
-- Migration: Add User Tracking to Orders
-- Description: เพิ่มคอลัมน์ created_by และ updated_by ในตาราง wms_orders
-- ============================================================================

-- เพิ่มคอลัมน์ created_by และ updated_by
ALTER TABLE wms_orders
ADD COLUMN IF NOT EXISTS created_by bigint REFERENCES master_system_user(user_id),
ADD COLUMN IF NOT EXISTS updated_by bigint REFERENCES master_system_user(user_id);

-- เพิ่ม comment
COMMENT ON COLUMN wms_orders.created_by IS 'ผู้สร้างออเดอร์ (user_id จาก master_system_user)';
COMMENT ON COLUMN wms_orders.updated_by IS 'ผู้แก้ไขออเดอร์ล่าสุด (user_id จาก master_system_user)';

-- สร้าง trigger function สำหรับอัพเดท updated_by อัตโนมัติ
CREATE OR REPLACE FUNCTION update_wms_orders_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  -- ดึง user_id จาก session variable
  BEGIN
    NEW.updated_by := get_current_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      -- ถ้าไม่มี user context ให้ใช้ค่าเดิม
      NEW.updated_by := OLD.updated_by;
  END;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger สำหรับอัพเดท updated_by
DROP TRIGGER IF EXISTS trigger_update_wms_orders_updated_by ON wms_orders;
CREATE TRIGGER trigger_update_wms_orders_updated_by
  BEFORE UPDATE ON wms_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_wms_orders_updated_by();

-- สร้าง trigger function สำหรับตั้งค่า created_by เมื่อสร้างใหม่
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger สำหรับตั้งค่า created_by
DROP TRIGGER IF EXISTS trigger_set_wms_orders_created_by ON wms_orders;
CREATE TRIGGER trigger_set_wms_orders_created_by
  BEFORE INSERT ON wms_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_wms_orders_created_by();

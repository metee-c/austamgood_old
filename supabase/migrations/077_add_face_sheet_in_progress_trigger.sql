-- Migration: Add trigger to update order status when face sheet starts picking
-- Created: 2025-12-02
-- Description: When face sheet changes to 'in_progress', update related orders to 'in_picking'

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_order_status_on_face_sheet_in_progress ON face_sheets;
DROP FUNCTION IF EXISTS update_order_status_on_face_sheet_in_progress();

-- Create function to update order status when face sheet starts picking
CREATE OR REPLACE FUNCTION update_order_status_on_face_sheet_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- เมื่อ face sheet เปลี่ยนเป็น 'picking' (กำลังหยิบ)
  IF NEW.status = 'picking' AND OLD.status != 'picking' THEN
    -- อัปเดตออเดอร์ที่เกี่ยวข้องเป็น 'in_picking'
    UPDATE wms_orders
    SET 
      status = 'in_picking',
      updated_at = NOW()
    WHERE order_id IN (
      SELECT DISTINCT order_id
      FROM face_sheet_items
      WHERE face_sheet_id = NEW.id
      AND order_id IS NOT NULL
    )
    AND status = 'confirmed'; -- เฉพาะออเดอร์ที่ยังเป็น confirmed
    
    RAISE NOTICE 'Updated orders to in_picking for face sheet %', NEW.face_sheet_no;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_order_status_on_face_sheet_in_progress
  AFTER UPDATE ON face_sheets
  FOR EACH ROW
  WHEN (NEW.status = 'picking' AND OLD.status IS DISTINCT FROM 'picking')
  EXECUTE FUNCTION update_order_status_on_face_sheet_in_progress();

COMMENT ON FUNCTION update_order_status_on_face_sheet_in_progress() IS 
'Automatically updates order status to in_picking when face sheet starts picking (in_progress)';

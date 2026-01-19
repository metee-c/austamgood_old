-- ============================================================================
-- Migration: 266_auto_rollback_orders_on_face_sheet_delete.sql
-- Description: ถอยสถานะออเดอร์อัตโนมัติเมื่อลบใบปะหน้า
-- 
-- เมื่อลบใบปะหน้า (face_sheets):
-- - ถอยสถานะออเดอร์ที่เกี่ยวข้องกลับไปเป็น 'draft'
-- - ใช้ได้กับออเดอร์ที่อยู่ในสถานะ 'confirmed' หรือ 'in_picking' เท่านั้น
-- ============================================================================

-- Function: ถอยสถานะออเดอร์เมื่อลบใบปะหน้า
CREATE OR REPLACE FUNCTION rollback_orders_on_face_sheet_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected_orders INTEGER := 0;
BEGIN
    -- ถอยสถานะออเดอร์ที่เกี่ยวข้องกับใบปะหน้าที่ถูกลบ
    -- เฉพาะออเดอร์ที่อยู่ในสถานะ confirmed หรือ in_picking
    UPDATE wms_orders
    SET 
        status = 'draft',
        updated_at = CURRENT_TIMESTAMP,
        updated_by = COALESCE(current_setting('app.current_user_id', true), 'System')
    WHERE order_id IN (
        SELECT DISTINCT fsi.order_id
        FROM face_sheet_items fsi
        WHERE fsi.face_sheet_id = OLD.id
    )
    AND status IN ('confirmed', 'in_picking');
    
    GET DIAGNOSTICS v_affected_orders = ROW_COUNT;
    
    -- Log การถอยสถานะ
    RAISE NOTICE 'ลบใบปะหน้า % - ถอยสถานะ % ออเดอร์กลับไปเป็น draft', 
        OLD.face_sheet_no, v_affected_orders;
    
    RETURN OLD;
END;
$$;

-- Trigger: เรียกใช้ function เมื่อลบใบปะหน้า
DROP TRIGGER IF EXISTS trigger_rollback_orders_on_face_sheet_delete ON face_sheets;

CREATE TRIGGER trigger_rollback_orders_on_face_sheet_delete
    BEFORE DELETE ON face_sheets
    FOR EACH ROW
    EXECUTE FUNCTION rollback_orders_on_face_sheet_delete();

COMMENT ON FUNCTION rollback_orders_on_face_sheet_delete IS 
'ถอยสถานะออเดอร์กลับไปเป็น draft อัตโนมัติเมื่อลบใบปะหน้า';

COMMENT ON TRIGGER trigger_rollback_orders_on_face_sheet_delete ON face_sheets IS
'ถอยสถานะออเดอร์อัตโนมัติเมื่อลบใบปะหน้า - ใช้ได้กับออเดอร์ที่อยู่ในสถานะ confirmed หรือ in_picking';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

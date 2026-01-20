-- ============================================================================
-- Migration: 272_fix_rollback_orders_updated_by_type.sql
-- Description: แก้ไข type mismatch ใน rollback_orders_on_face_sheet_delete
--
-- BUG: updated_by column เป็น bigint แต่ใช้ COALESCE(current_setting(), 'System')
--      ซึ่งคืนค่า text
--
-- FIX: ลบการ set updated_by ออก เพราะ trigger trigger_update_wms_orders_updated_by
--      จะจัดการให้อัตโนมัติเมื่อ UPDATE
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
    -- ✅ FIX: Remove updated_by assignment - let trigger_update_wms_orders_updated_by handle it
    UPDATE wms_orders
    SET
        status = 'draft',
        updated_at = CURRENT_TIMESTAMP
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

COMMENT ON FUNCTION rollback_orders_on_face_sheet_delete IS
'ถอยสถานะออเดอร์กลับไปเป็น draft อัตโนมัติเมื่อลบใบปะหน้า (Fix: removed updated_by type mismatch)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================
-- Migration 076: Add Face Sheet Complete Trigger
-- สร้าง Trigger อัปเดตสถานะออเดอร์เมื่อ Face Sheet เสร็จ
-- Date: 2025-12-02
-- ============================================================

-- สร้าง Function อัปเดตสถานะออเดอร์เมื่อ Face Sheet เปลี่ยนเป็น completed
CREATE OR REPLACE FUNCTION update_orders_on_face_sheet_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Face Sheet เปลี่ยนเป็น 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- อัปเดต Orders จาก 'in_picking' → 'picked' (รองรับทั้ง confirmed และ in_picking)
        UPDATE wms_orders
        SET status = 'picked', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT fsi.order_id
            FROM face_sheet_items fsi
            WHERE fsi.face_sheet_id = NEW.id
            AND fsi.order_id IS NOT NULL
        )
        AND status IN ('confirmed', 'in_picking');
        
        RAISE NOTICE 'Face Sheet % completed. Updated orders to picked.', NEW.face_sheet_no;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง Trigger
DROP TRIGGER IF EXISTS trigger_face_sheet_complete_update_orders ON face_sheets;

CREATE TRIGGER trigger_face_sheet_complete_update_orders
    AFTER UPDATE ON face_sheets
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_face_sheet_complete();

COMMENT ON FUNCTION update_orders_on_face_sheet_complete() IS 
'เมื่อ Face Sheet completed → Orders: confirmed→picked';

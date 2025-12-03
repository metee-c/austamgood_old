-- Migration: Add triggers to update order status for bonus face sheets
-- Similar to face sheets, bonus face sheets should update order status when:
-- 1. Picking is completed (bonus_face_sheet.status = 'completed')
-- 2. Loading is completed (loadlist.status = 'loaded')

-- =====================================================
-- Function: Update orders when bonus face sheet is completed
-- =====================================================
CREATE OR REPLACE FUNCTION update_orders_on_bonus_face_sheet_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Bonus Face Sheet เปลี่ยนเป็น 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- อัปเดต Orders จาก 'draft' หรือ 'confirmed' → 'picked'
        UPDATE wms_orders
        SET status = 'picked', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT bfsp.order_id
            FROM bonus_face_sheet_packages bfsp
            WHERE bfsp.face_sheet_id = NEW.id
            AND bfsp.order_id IS NOT NULL
        )
        AND status IN ('draft', 'confirmed', 'in_picking');
        
        RAISE NOTICE 'Bonus Face Sheet % completed. Updated orders to picked.', NEW.face_sheet_no;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Update orders when bonus face sheet is completed
-- =====================================================
DROP TRIGGER IF EXISTS trigger_bonus_face_sheet_complete_update_orders ON bonus_face_sheets;

CREATE TRIGGER trigger_bonus_face_sheet_complete_update_orders
AFTER UPDATE ON bonus_face_sheets
FOR EACH ROW
EXECUTE FUNCTION update_orders_on_bonus_face_sheet_complete();

-- =====================================================
-- Function: Update orders when bonus face sheet is in progress
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_status_on_bonus_face_sheet_in_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Bonus Face Sheet เปลี่ยนเป็น 'in_progress'
    IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
        
        -- อัปเดต Orders จาก 'draft' หรือ 'confirmed' → 'in_picking'
        UPDATE wms_orders
        SET status = 'in_picking', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT bfsp.order_id
            FROM bonus_face_sheet_packages bfsp
            WHERE bfsp.face_sheet_id = NEW.id
            AND bfsp.order_id IS NOT NULL
        )
        AND status IN ('draft', 'confirmed');
        
        RAISE NOTICE 'Bonus Face Sheet % in progress. Updated orders to in_picking.', NEW.face_sheet_no;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Update orders when bonus face sheet is in progress
-- =====================================================
DROP TRIGGER IF EXISTS update_order_status_on_bonus_face_sheet_in_progress ON bonus_face_sheets;

CREATE TRIGGER update_order_status_on_bonus_face_sheet_in_progress
AFTER UPDATE ON bonus_face_sheets
FOR EACH ROW
EXECUTE FUNCTION update_order_status_on_bonus_face_sheet_in_progress();

-- =====================================================
-- Update existing function to include bonus face sheets in loadlist
-- =====================================================
CREATE OR REPLACE FUNCTION update_orders_on_loadlist_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded'
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN
        
        -- อัปเดต Orders จาก Picklists: 'picked' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT pi.order_id
            FROM loadlist_picklists llp
            JOIN picklist_items pi ON pi.picklist_id = llp.picklist_id
            WHERE llp.loadlist_id = NEW.id
            AND pi.order_id IS NOT NULL
        )
        AND status = 'picked';
        
        -- อัปเดต Orders จาก Face Sheets: 'confirmed' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT fsi.order_id
            FROM loadlist_face_sheets lfs
            JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
            WHERE lfs.loadlist_id = NEW.id
            AND fsi.order_id IS NOT NULL
        )
        AND status IN ('confirmed', 'picked');
        
        -- อัปเดต Orders จาก Bonus Face Sheets: 'picked' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT bfsp.order_id
            FROM wms_loadlist_bonus_face_sheets llbfs
            JOIN bonus_face_sheet_packages bfsp ON bfsp.face_sheet_id = llbfs.bonus_face_sheet_id
            WHERE llbfs.loadlist_id = NEW.id
            AND bfsp.order_id IS NOT NULL
        )
        AND status IN ('confirmed', 'picked');
        
        RAISE NOTICE 'Loadlist % completed. Updated orders to loaded.', NEW.loadlist_code;
        
        -- อัปเดต Route Plan เป็น 'in_transit' ถ้ามี plan_id
        IF NEW.plan_id IS NOT NULL THEN
            UPDATE receiving_route_plans
            SET status = 'in_transit', updated_at = NOW()
            WHERE plan_id = NEW.plan_id
            AND status = 'ready_to_load';
            
            RAISE NOTICE 'Route Plan ID % status changed to in_transit.', NEW.plan_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION update_orders_on_bonus_face_sheet_complete() IS 
'Updates order status to picked when bonus face sheet picking is completed';

COMMENT ON FUNCTION update_order_status_on_bonus_face_sheet_in_progress() IS 
'Updates order status to in_picking when bonus face sheet picking starts';

COMMENT ON FUNCTION update_orders_on_loadlist_complete() IS 
'Updates order status to loaded when loadlist is completed (includes picklists, face sheets, and bonus face sheets)';

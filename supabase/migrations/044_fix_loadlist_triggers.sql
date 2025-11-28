-- ============================================================
-- Migration 044: Fix Loadlist Triggers
-- แก้ไข Triggers ให้ทำงานกับ wms_loadlist_picklists แทน loadlist_items
-- Date: 2025-11-28
-- ============================================================

-- 1. ลบ Trigger เก่าที่ใช้ loadlist_items
DROP TRIGGER IF EXISTS trigger_loadlist_item_update_order ON loadlist_items;
DROP TRIGGER IF EXISTS trigger_departure_update_orders_and_route ON loadlists;
DROP TRIGGER IF EXISTS trigger_delivery_update_loadlist_and_route ON wms_orders;

-- 2. สร้าง Function ใหม่สำหรับ Loadlist Completion
CREATE OR REPLACE FUNCTION update_orders_on_loadlist_complete()
RETURNS TRIGGER AS $
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded'
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN
        
        -- อัปเดต Orders จาก 'picked' → 'loaded'
        UPDATE wms_orders
        SET status = 'loaded', updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT pi.order_id
            FROM wms_loadlist_picklists llp
            JOIN picklist_items pi ON pi.picklist_id = llp.picklist_id
            WHERE llp.loadlist_id = NEW.id
            AND pi.order_id IS NOT NULL
        )
        AND status = 'picked';
        
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
$ LANGUAGE plpgsql;

-- 3. สร้าง Trigger ใหม่
CREATE TRIGGER trigger_loadlist_complete_update_orders
    AFTER UPDATE ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_loadlist_complete();

COMMENT ON FUNCTION update_orders_on_loadlist_complete() IS 
'เมื่อ Loadlist loaded → Orders: picked→loaded, Route: ready_to_load→in_transit';

-- 4. แก้ไข Function สำหรับ Order Delivered
CREATE OR REPLACE FUNCTION update_route_on_delivery()
RETURNS TRIGGER AS $
DECLARE
    v_plan_id BIGINT;
    v_all_delivered BOOLEAN;
BEGIN
    -- เมื่อ Order เปลี่ยนเป็น 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN

        -- หา plan_id จาก picklist ที่ order นี้อยู่
        SELECT DISTINCT p.plan_id INTO v_plan_id
        FROM picklist_items pi
        JOIN picklists p ON p.id = pi.picklist_id
        WHERE pi.order_id = NEW.order_id
        AND p.plan_id IS NOT NULL
        LIMIT 1;

        IF v_plan_id IS NOT NULL THEN
            -- ตรวจสอบว่า Orders ทั้งหมดใน Plan นี้ส่งถึงหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM wms_orders o
                JOIN picklist_items pi ON pi.order_id = o.order_id
                JOIN picklists p ON p.id = pi.picklist_id
                WHERE p.plan_id = v_plan_id
                AND o.status != 'delivered'
            ) INTO v_all_delivered;

            -- ถ้าส่งถึงหมดแล้ว → Route completed
            IF v_all_delivered THEN
                UPDATE receiving_route_plans
                SET status = 'completed', updated_at = NOW()
                WHERE plan_id = v_plan_id
                AND status = 'in_transit';

                RAISE NOTICE 'All orders delivered for Route Plan ID %. Status changed to completed.', v_plan_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 5. สร้าง Trigger ใหม่
CREATE TRIGGER trigger_delivery_update_route
    AFTER UPDATE ON wms_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_route_on_delivery();

COMMENT ON FUNCTION update_route_on_delivery() IS 
'เมื่อ Order delivered → Route: in_transit→completed (ถ้าทุก Order ส่งถึง)';

-- 6. สรุปการเปลี่ยนแปลง
-- ✅ ลบ Triggers เก่าที่ใช้ loadlist_items
-- ✅ สร้าง Function ใหม่ที่ใช้ wms_loadlist_picklists
-- ✅ อัปเดต Orders: picked → loaded เมื่อ loadlist loaded
-- ✅ อัปเดต Route: ready_to_load → in_transit เมื่อ loadlist loaded
-- ✅ อัปเดต Route: in_transit → completed เมื่อทุก Order delivered


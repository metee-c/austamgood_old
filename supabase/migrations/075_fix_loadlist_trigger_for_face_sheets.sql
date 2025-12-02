-- ============================================================
-- Migration 075: Fix Loadlist Trigger to Support Face Sheets
-- แก้ไข Trigger ให้รองรับทั้ง Picklists และ Face Sheets
-- Date: 2025-12-02
-- ============================================================

-- แก้ไข Function สำหรับ Loadlist Completion ให้รองรับ Face Sheets
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

COMMENT ON FUNCTION update_orders_on_loadlist_complete() IS 
'เมื่อ Loadlist loaded → Orders: picked/confirmed→loaded (รองรับทั้ง Picklists และ Face Sheets), Route: ready_to_load→in_transit';

-- แก้ไข Function สำหรับ Order Delivered ให้รองรับ Face Sheets
CREATE OR REPLACE FUNCTION update_route_on_delivery()
RETURNS TRIGGER AS $$
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

        -- ถ้าไม่เจอใน picklist ให้ลองหาจาก face sheet
        IF v_plan_id IS NULL THEN
            -- Face sheets ไม่มี plan_id โดยตรง แต่อาจจะเพิ่มในอนาคต
            -- ตอนนี้ข้ามไปก่อน
            NULL;
        END IF;

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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_route_on_delivery() IS 
'เมื่อ Order delivered → Route: in_transit→completed (ถ้าทุก Order ส่งถึง)';

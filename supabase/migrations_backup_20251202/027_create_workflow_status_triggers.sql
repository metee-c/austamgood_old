-- Migration: Create Workflow Status Triggers
-- Description: สร้าง Triggers สำหรับการเชื่อมโยงสถานะอัตโนมัติระหว่าง Orders, Route Plans, Picklists, Loadlists
-- Date: 2025-01-22

-- ============================================================
-- TRIGGER 1: Route Plan Publish → Update Orders to Confirmed
-- ============================================================

CREATE OR REPLACE FUNCTION update_orders_on_route_publish()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Route Plan เปลี่ยนเป็น 'published'
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        -- อัปเดต Orders ที่อยู่ใน Route Plan นี้จาก draft → confirmed
        UPDATE wms_orders
        SET
            status = 'confirmed',
            updated_at = NOW()
        WHERE order_id IN (
            -- ดึง order_ids จาก route_trip_stops
            SELECT DISTINCT unnest(s.order_ids)
            FROM receiving_route_trip_stops s
            INNER JOIN receiving_route_trips t ON s.trip_id = t.trip_id
            WHERE t.plan_id = NEW.plan_id
            AND s.order_ids IS NOT NULL
        )
        AND status = 'draft';

        RAISE NOTICE 'Route Plan % published. Updated orders to confirmed.', NEW.plan_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_route_publish_update_orders ON receiving_route_plans;
CREATE TRIGGER trigger_route_publish_update_orders
    AFTER UPDATE ON receiving_route_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_route_publish();

COMMENT ON FUNCTION update_orders_on_route_publish() IS 'เมื่อ Route Plan published → Orders เปลี่ยนจาก draft → confirmed';


-- ============================================================
-- TRIGGER 2: Picklist Created → Update Orders to In_Picking
-- ============================================================

CREATE OR REPLACE FUNCTION update_orders_on_picklist_create()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อ Picklist ถูกสร้างใหม่ (INSERT)
    -- อัปเดต Orders ที่อยู่ใน Picklist จาก confirmed → in_picking
    UPDATE wms_orders
    SET
        status = 'in_picking',
        updated_at = NOW()
    WHERE order_id IN (
        SELECT DISTINCT order_id
        FROM picklist_items
        WHERE picklist_id = NEW.id
        AND order_id IS NOT NULL
    )
    AND status = 'confirmed';

    RAISE NOTICE 'Picklist % created. Updated orders to in_picking.', NEW.picklist_code;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_picklist_create_update_orders ON picklists;
CREATE TRIGGER trigger_picklist_create_update_orders
    AFTER INSERT ON picklists
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_on_picklist_create();

COMMENT ON FUNCTION update_orders_on_picklist_create() IS 'เมื่อ Picklist สร้างใหม่ → Orders เปลี่ยนจาก confirmed → in_picking';


-- ============================================================
-- TRIGGER 3: Picklist Completed → Update Orders & Route Plan
-- ============================================================

CREATE OR REPLACE FUNCTION update_orders_and_route_on_picklist_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id BIGINT;
    v_all_completed BOOLEAN;
BEGIN
    -- เมื่อ Picklist เปลี่ยนเป็น 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

        -- 1. อัปเดต Orders จาก in_picking → picked
        UPDATE wms_orders
        SET
            status = 'picked',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT DISTINCT order_id
            FROM picklist_items
            WHERE picklist_id = NEW.id
            AND order_id IS NOT NULL
        )
        AND status = 'in_picking';

        RAISE NOTICE 'Picklist % completed. Updated orders to picked.', NEW.picklist_code;

        -- 2. ตรวจสอบ Route Plan
        v_plan_id := NEW.plan_id;

        IF v_plan_id IS NOT NULL THEN
            -- ตรวจสอบว่า Picklists ทั้งหมดใน Plan นี้เสร็จหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM picklists
                WHERE plan_id = v_plan_id
                AND status NOT IN ('completed', 'cancelled')
            ) INTO v_all_completed;

            -- ถ้าเสร็จหมดแล้ว → เปลี่ยน Route Plan เป็น ready_to_load
            IF v_all_completed THEN
                UPDATE receiving_route_plans
                SET
                    status = 'ready_to_load',
                    updated_at = NOW()
                WHERE plan_id = v_plan_id
                AND status = 'published';

                RAISE NOTICE 'All picklists completed for Route Plan ID %. Status changed to ready_to_load.', v_plan_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_picklist_complete_update_orders_and_route ON picklists;
CREATE TRIGGER trigger_picklist_complete_update_orders_and_route
    AFTER UPDATE ON picklists
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_and_route_on_picklist_complete();

COMMENT ON FUNCTION update_orders_and_route_on_picklist_complete() IS 'เมื่อ Picklist completed → Orders: in_picking→picked, Route: published→ready_to_load (ถ้าทุก Picklist เสร็จ)';


-- ============================================================
-- TRIGGER 4: Loadlist Item Added → Update Order to Loaded
-- ============================================================

CREATE OR REPLACE FUNCTION update_order_on_loadlist_scan()
RETURNS TRIGGER AS $$
BEGIN
    -- เมื่อมี Order ถูกเพิ่มเข้า Loadlist (สแกนขึ้นรถ)
    -- อัปเดต Order จาก picked → loaded
    UPDATE wms_orders
    SET
        status = 'loaded',
        updated_at = NOW()
    WHERE order_id = NEW.order_id
    AND status = 'picked';

    -- อัปเดต Loadlist status เป็น loading (ถ้ายังเป็น pending)
    UPDATE loadlists
    SET
        status = 'loading',
        updated_at = NOW()
    WHERE id = NEW.loadlist_id
    AND status = 'pending';

    RAISE NOTICE 'Order % scanned into Loadlist %. Order status changed to loaded.', NEW.order_id, NEW.loadlist_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_loadlist_item_update_order ON loadlist_items;
CREATE TRIGGER trigger_loadlist_item_update_order
    AFTER INSERT ON loadlist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_on_loadlist_scan();

COMMENT ON FUNCTION update_order_on_loadlist_scan() IS 'เมื่อสแกนขึ้นรถ → Order: picked→loaded, Loadlist: pending→loading';


-- ============================================================
-- TRIGGER 5: Loadlist Departure → Update Orders & Route Plan
-- ============================================================

CREATE OR REPLACE FUNCTION update_orders_and_route_on_departure()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id BIGINT;
BEGIN
    -- เมื่อ Loadlist เปลี่ยนเป็น 'loaded' (พร้อมออกจัดส่ง)
    IF NEW.status = 'loaded' AND (OLD.status IS NULL OR OLD.status != 'loaded') THEN

        -- 1. อัปเดต Orders จาก loaded → in_transit
        UPDATE wms_orders
        SET
            status = 'in_transit',
            updated_at = NOW()
        WHERE order_id IN (
            SELECT order_id
            FROM loadlist_items
            WHERE loadlist_id = NEW.id
        )
        AND status = 'loaded';

        RAISE NOTICE 'Loadlist % departed. Updated orders to in_transit.', NEW.loadlist_code;

        -- 2. อัปเดต Route Plan เป็น in_transit
        v_plan_id := NEW.plan_id;

        IF v_plan_id IS NOT NULL THEN
            UPDATE receiving_route_plans
            SET
                status = 'in_transit',
                updated_at = NOW()
            WHERE plan_id = v_plan_id
            AND status = 'ready_to_load';

            RAISE NOTICE 'Route Plan ID % status changed to in_transit.', v_plan_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_departure_update_orders_and_route ON loadlists;
CREATE TRIGGER trigger_departure_update_orders_and_route
    AFTER UPDATE ON loadlists
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_and_route_on_departure();

COMMENT ON FUNCTION update_orders_and_route_on_departure() IS 'เมื่อรถออกจัดส่ง (Loadlist loaded) → Orders: loaded→in_transit, Route: ready_to_load→in_transit';


-- ============================================================
-- TRIGGER 6: Order Delivered → Update Loadlist & Route Plan
-- ============================================================

CREATE OR REPLACE FUNCTION update_loadlist_and_route_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
    v_loadlist_id BIGINT;
    v_plan_id BIGINT;
    v_all_delivered BOOLEAN;
    v_all_loadlists_completed BOOLEAN;
BEGIN
    -- เมื่อ Order เปลี่ยนเป็น 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN

        -- 1. หา Loadlist ที่ Order นี้อยู่
        SELECT loadlist_id INTO v_loadlist_id
        FROM loadlist_items
        WHERE order_id = NEW.order_id
        LIMIT 1;

        IF v_loadlist_id IS NOT NULL THEN
            -- ตรวจสอบว่า Orders ทั้งหมดใน Loadlist ส่งถึงหรือยัง
            SELECT NOT EXISTS (
                SELECT 1
                FROM wms_orders o
                INNER JOIN loadlist_items li ON o.order_id = li.order_id
                WHERE li.loadlist_id = v_loadlist_id
                AND o.status != 'delivered'
            ) INTO v_all_delivered;

            -- ถ้าส่งถึงหมดแล้ว → Loadlist completed
            IF v_all_delivered THEN
                UPDATE loadlists
                SET
                    status = 'completed',
                    updated_at = NOW()
                WHERE id = v_loadlist_id
                AND status = 'loaded'
                RETURNING plan_id INTO v_plan_id;

                RAISE NOTICE 'All orders delivered for Loadlist ID %. Status changed to completed.', v_loadlist_id;

                -- 2. ตรวจสอบ Route Plan
                IF v_plan_id IS NOT NULL THEN
                    SELECT NOT EXISTS (
                        SELECT 1
                        FROM loadlists
                        WHERE plan_id = v_plan_id
                        AND status NOT IN ('completed', 'cancelled')
                    ) INTO v_all_loadlists_completed;

                    -- ถ้า Loadlists ทั้งหมดเสร็จแล้ว → Route completed
                    IF v_all_loadlists_completed THEN
                        UPDATE receiving_route_plans
                        SET
                            status = 'completed',
                            updated_at = NOW()
                        WHERE plan_id = v_plan_id
                        AND status = 'in_transit';

                        RAISE NOTICE 'All loadlists completed for Route Plan ID %. Status changed to completed.', v_plan_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delivery_update_loadlist_and_route ON wms_orders;
CREATE TRIGGER trigger_delivery_update_loadlist_and_route
    AFTER UPDATE ON wms_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_loadlist_and_route_on_delivery();

COMMENT ON FUNCTION update_loadlist_and_route_on_delivery() IS 'เมื่อ Order delivered → Loadlist: loaded→completed (ถ้าทุก Order ส่งถึง), Route: in_transit→completed (ถ้าทุก Loadlist เสร็จ)';


-- ============================================================
-- สรุปการสร้าง Triggers
-- ============================================================

-- Migration Summary:
-- 1. ✅ Trigger: Route Publish → Orders (draft→confirmed)
-- 2. ✅ Trigger: Picklist Create → Orders (confirmed→in_picking)
-- 3. ✅ Trigger: Picklist Complete → Orders (in_picking→picked) + Route (published→ready_to_load)
-- 4. ✅ Trigger: Loadlist Scan → Orders (picked→loaded) + Loadlist (pending→loading)
-- 5. ✅ Trigger: Loadlist Depart → Orders (loaded→in_transit) + Route (ready_to_load→in_transit)
-- 6. ✅ Trigger: Order Delivered → Loadlist (loaded→completed) + Route (in_transit→completed)

-- ทั้งหมด 6 Triggers ที่ครอบคลุม Workflow ทั้งหมด

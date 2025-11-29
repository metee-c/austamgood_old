-- ============================================================
-- Migration 049: Add Status Transition Validation (State Machine)
-- วันที่: 2025-11-29
-- เหตุผล: ป้องกันการเปลี่ยนสถานะผิดลำดับ workflow
-- ============================================================

-- ============================================================
-- 1. Validate Picklist Status Transitions
-- ============================================================

CREATE OR REPLACE FUNCTION validate_picklist_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions based on current status
    CASE OLD.status
        -- From 'pending'
        WHEN 'pending' THEN
            IF NEW.status NOT IN ('assigned', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: pending → %. Allowed: assigned, cancelled', NEW.status;
            END IF;

        -- From 'assigned'
        WHEN 'assigned' THEN
            IF NEW.status NOT IN ('picking', 'pending', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: assigned → %. Allowed: picking, pending, cancelled', NEW.status;
            END IF;

        -- From 'picking'
        WHEN 'picking' THEN
            IF NEW.status NOT IN ('completed', 'assigned', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid status transition: picking → %. Allowed: completed, assigned, cancelled', NEW.status;
            END IF;

        -- From 'completed' (final state)
        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        -- From 'cancelled' (final state)
        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown picklist status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Picklist % status changed: % → %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_picklist_status
    BEFORE UPDATE ON picklists
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_picklist_status_transition();

COMMENT ON FUNCTION validate_picklist_status_transition() IS
'Validates picklist status transitions to prevent invalid workflow state changes';

-- ============================================================
-- 2. Validate Loadlist Status Transitions
-- ============================================================

CREATE OR REPLACE FUNCTION validate_loadlist_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        -- From 'pending'
        WHEN 'pending' THEN
            IF NEW.status NOT IN ('loaded', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: pending → %. Allowed: loaded, cancelled', NEW.status;
            END IF;

        -- From 'loaded' (final state - waiting for completion)
        WHEN 'loaded' THEN
            IF NEW.status NOT IN ('completed', 'loaded') THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: loaded → %. Allowed: completed', NEW.status;
            END IF;

        -- From 'completed' (final state)
        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        -- From 'cancelled' (final state)
        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid loadlist status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown loadlist status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Loadlist % status changed: % → %', NEW.id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_loadlist_status
    BEFORE UPDATE ON loadlists
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_loadlist_status_transition();

COMMENT ON FUNCTION validate_loadlist_status_transition() IS
'Validates loadlist status transitions to prevent invalid workflow state changes';

-- ============================================================
-- 3. Validate Order Status Transitions
-- ============================================================

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        WHEN 'draft' THEN
            IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: draft → %. Allowed: confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'confirmed' THEN
            IF NEW.status NOT IN ('in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: confirmed → %. Allowed: in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'in_picking' THEN
            IF NEW.status NOT IN ('picked', 'confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_picking → %. Allowed: picked, confirmed, cancelled', NEW.status;
            END IF;

        WHEN 'picked' THEN
            IF NEW.status NOT IN ('loaded', 'in_picking', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: picked → %. Allowed: loaded, in_picking, cancelled', NEW.status;
            END IF;

        WHEN 'loaded' THEN
            IF NEW.status NOT IN ('in_transit', 'picked', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: loaded → %. Allowed: in_transit, picked, cancelled', NEW.status;
            END IF;

        WHEN 'in_transit' THEN
            IF NEW.status NOT IN ('delivered', 'failed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid order status transition: in_transit → %. Allowed: delivered, failed, cancelled', NEW.status;
            END IF;

        WHEN 'delivered' THEN
            -- Final state - cannot change
            IF NEW.status != 'delivered' THEN
                RAISE EXCEPTION 'Invalid order status transition: delivered is a final state. Cannot change to %', NEW.status;
            END IF;

        WHEN 'failed' THEN
            -- Can retry
            IF NEW.status NOT IN ('in_transit', 'cancelled', 'failed') THEN
                RAISE EXCEPTION 'Invalid order status transition: failed → %. Allowed: in_transit (retry), cancelled', NEW.status;
            END IF;

        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid order status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown order status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Order % status changed: % → %', NEW.order_id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_order_status
    BEFORE UPDATE ON wms_orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_order_status_transition();

COMMENT ON FUNCTION validate_order_status_transition() IS
'Validates order status transitions to prevent invalid workflow state changes';

-- ============================================================
-- 4. Validate Route Plan Status Transitions
-- ============================================================

CREATE OR REPLACE FUNCTION validate_route_plan_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้าสถานะไม่เปลี่ยน → อนุญาต
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transitions
    CASE OLD.status
        WHEN 'draft' THEN
            IF NEW.status NOT IN ('optimizing', 'published', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: draft → %. Allowed: optimizing, published, cancelled', NEW.status;
            END IF;

        WHEN 'optimizing' THEN
            IF NEW.status NOT IN ('published', 'draft', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: optimizing → %. Allowed: published, draft, cancelled', NEW.status;
            END IF;

        WHEN 'published' THEN
            IF NEW.status NOT IN ('pending_approval', 'ready_to_load', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: published → %. Allowed: pending_approval, ready_to_load, cancelled', NEW.status;
            END IF;

        WHEN 'pending_approval' THEN
            IF NEW.status NOT IN ('approved', 'published', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: pending_approval → %. Allowed: approved, published, cancelled', NEW.status;
            END IF;

        WHEN 'approved' THEN
            IF NEW.status NOT IN ('ready_to_load', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: approved → %. Allowed: ready_to_load, cancelled', NEW.status;
            END IF;

        WHEN 'ready_to_load' THEN
            IF NEW.status NOT IN ('in_transit', 'approved', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: ready_to_load → %. Allowed: in_transit, approved, cancelled', NEW.status;
            END IF;

        WHEN 'in_transit' THEN
            IF NEW.status NOT IN ('completed', 'in_transit') THEN
                RAISE EXCEPTION 'Invalid route plan status transition: in_transit → %. Allowed: completed', NEW.status;
            END IF;

        WHEN 'completed' THEN
            IF NEW.status != 'completed' THEN
                RAISE EXCEPTION 'Invalid route plan status transition: completed is a final state. Cannot change to %', NEW.status;
            END IF;

        WHEN 'cancelled' THEN
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Invalid route plan status transition: cancelled is a final state. Cannot change to %', NEW.status;
            END IF;

        ELSE
            RAISE EXCEPTION 'Unknown route plan status: %', OLD.status;
    END CASE;

    RAISE NOTICE 'Route Plan % status changed: % → %', NEW.plan_id, OLD.status, NEW.status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_route_plan_status
    BEFORE UPDATE ON receiving_route_plans
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_route_plan_status_transition();

COMMENT ON FUNCTION validate_route_plan_status_transition() IS
'Validates route plan status transitions to prevent invalid workflow state changes';

-- ============================================================
-- 5. สรุปการเปลี่ยนแปลง
-- ============================================================

/*
Migration Summary:
✅ Created status transition validation for picklists
✅ Created status transition validation for loadlists
✅ Created status transition validation for orders
✅ Created status transition validation for route plans

State Machine Enforcement:
- ป้องกันการข้ามขั้นตอน (skip states)
- ป้องกันการเปลี่ยนจาก final states (completed, cancelled)
- อนุญาตการย้อนกลับบางขั้นตอน (rollback) เท่าที่จำเป็น
- Log ทุกการเปลี่ยนสถานะผ่าน RAISE NOTICE

Benefits:
- ✅ Data integrity สูงขึ้น
- ✅ ป้องกัน workflow ผิดลำดับ
- ✅ Debug ง่ายขึ้นด้วย log messages
- ✅ Clear business rules
*/

-- Verify triggers were created
DO $$
DECLARE
    v_trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgname IN (
        'trigger_validate_picklist_status',
        'trigger_validate_loadlist_status',
        'trigger_validate_order_status',
        'trigger_validate_route_plan_status'
    );

    IF v_trigger_count = 4 THEN
        RAISE NOTICE '✅ All 4 status validation triggers created successfully';
    ELSE
        RAISE WARNING '⚠️ Expected 4 triggers, found %', v_trigger_count;
    END IF;
END $$;

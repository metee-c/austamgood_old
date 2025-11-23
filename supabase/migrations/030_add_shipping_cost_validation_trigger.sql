-- Migration: Add Shipping Cost Validation Trigger
-- Description: สร้าง Trigger ตรวจสอบค่าขนส่งครบทุกเที่ยว แล้วเปลี่ยนสถานะ optimizing → published อัตโนมัติ
-- Date: 2025-01-23

-- ============================================================
-- TRIGGER 7: Trip Shipping Cost Updated → Check All Trips & Update Plan Status
-- ============================================================

CREATE OR REPLACE FUNCTION check_shipping_cost_complete_and_publish()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id BIGINT;
    v_plan_status TEXT;
    v_all_trips_have_cost BOOLEAN;
    v_total_cost NUMERIC;
BEGIN
    -- ดึง plan_id และ status ของ Route Plan
    SELECT plan_id, status INTO v_plan_id, v_plan_status
    FROM receiving_route_plans
    WHERE plan_id = NEW.plan_id;

    -- ทำงานเฉพาะเมื่อ Route Plan อยู่ในสถานะ 'optimizing' เท่านั้น
    IF v_plan_status = 'optimizing' THEN
        -- ตรวจสอบว่าทุกเที่ยวในแผนนี้มีค่าขนส่งหรือยัง
        SELECT NOT EXISTS (
            SELECT 1
            FROM receiving_route_trips
            WHERE plan_id = v_plan_id
            AND (shipping_cost IS NULL OR shipping_cost = 0)
        ) INTO v_all_trips_have_cost;

        -- ถ้าทุกเที่ยวมีค่าขนส่งครบแล้ว
        IF v_all_trips_have_cost THEN
            -- คำนวณต้นทุนรวม (objective_value) จากค่าขนส่งทั้งหมด
            SELECT COALESCE(SUM(shipping_cost), 0) INTO v_total_cost
            FROM receiving_route_trips
            WHERE plan_id = v_plan_id;

            -- เปลี่ยนสถานะ Route Plan เป็น 'published'
            UPDATE receiving_route_plans
            SET
                status = 'published',
                objective_value = v_total_cost,
                updated_at = NOW()
            WHERE plan_id = v_plan_id
            AND status = 'optimizing';

            RAISE NOTICE 'Route Plan ID % → All trips have shipping cost. Status changed to PUBLISHED (Total Cost: %)', v_plan_id, v_total_cost;
        ELSE
            RAISE NOTICE 'Route Plan ID % → Shipping cost incomplete. Still in OPTIMIZING status.', v_plan_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_shipping_cost_complete ON receiving_route_trips;
CREATE TRIGGER trigger_check_shipping_cost_complete
    AFTER UPDATE OF shipping_cost ON receiving_route_trips
    FOR EACH ROW
    WHEN (NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost)
    EXECUTE FUNCTION check_shipping_cost_complete_and_publish();

COMMENT ON FUNCTION check_shipping_cost_complete_and_publish() IS 'เมื่อมีการอัปเดตค่าขนส่ง → ตรวจสอบว่าครบทุกเที่ยวหรือยัง ถ้าครบ → เปลี่ยนสถานะ optimizing → published อัตโนมัติ';


-- ============================================================
-- FUNCTION: Manual Check Shipping Cost Completion
-- ============================================================

CREATE OR REPLACE FUNCTION check_and_publish_if_cost_complete(p_plan_id BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_plan_status TEXT;
    v_all_trips_have_cost BOOLEAN;
    v_total_cost NUMERIC;
    v_trips_without_cost INTEGER;
BEGIN
    -- ดึงสถานะ Route Plan
    SELECT status INTO v_plan_status
    FROM receiving_route_plans
    WHERE plan_id = p_plan_id;

    -- ถ้าไม่ใช่สถานะ optimizing → return error
    IF v_plan_status != 'optimizing' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Route Plan status must be OPTIMIZING',
            'current_status', v_plan_status
        );
    END IF;

    -- นับจำนวนเที่ยวที่ยังไม่มีค่าขนส่ง
    SELECT COUNT(*) INTO v_trips_without_cost
    FROM receiving_route_trips
    WHERE plan_id = p_plan_id
    AND (shipping_cost IS NULL OR shipping_cost = 0);

    -- ตรวจสอบว่าทุกเที่ยวมีค่าขนส่งหรือยัง
    SELECT NOT EXISTS (
        SELECT 1
        FROM receiving_route_trips
        WHERE plan_id = p_plan_id
        AND (shipping_cost IS NULL OR shipping_cost = 0)
    ) INTO v_all_trips_have_cost;

    -- ถ้าครบแล้ว → เปลี่ยนสถานะเป็น published
    IF v_all_trips_have_cost THEN
        -- คำนวณต้นทุนรวม
        SELECT COALESCE(SUM(shipping_cost), 0) INTO v_total_cost
        FROM receiving_route_trips
        WHERE plan_id = p_plan_id;

        -- อัปเดตสถานะ
        UPDATE receiving_route_plans
        SET
            status = 'published',
            objective_value = v_total_cost,
            updated_at = NOW()
        WHERE plan_id = p_plan_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Route Plan published successfully',
            'new_status', 'published',
            'total_cost', v_total_cost
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Shipping cost incomplete',
            'trips_without_cost', v_trips_without_cost
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_and_publish_if_cost_complete(BIGINT) IS 'ตรวจสอบและเปลี่ยนสถานะ Route Plan เป็น published ถ้าค่าขนส่งครบ (ใช้เรียกด้วยตนเองได้)';


-- ============================================================
-- สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- 1. ✅ สร้าง Trigger: เมื่ออัปเดตค่าขนส่งใน trip → ตรวจสอบว่าครบทุกเที่ยวหรือยัง
-- 2. ✅ ถ้าครบ → เปลี่ยนสถานะ Route Plan จาก 'optimizing' → 'published' อัตโนมัติ
-- 3. ✅ คำนวณ objective_value = SUM(shipping_cost) ของทุกเที่ยว
-- 4. ✅ สร้าง Function สำหรับตรวจสอบและเผยแพร่ด้วยตนเอง (ถ้าต้องการ)

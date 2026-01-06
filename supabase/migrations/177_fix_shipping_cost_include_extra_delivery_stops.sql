-- Migration: Fix shipping_cost calculation to include extra_delivery_stops
-- ปัญหา: shipping_cost ใน database ไม่รวมค่าจุดส่งพิเศษ (extra_delivery_stops)
-- ทำให้ฟอร์มแก้ไขแสดง 3,500 บาท แต่เอกสารปริ้นแสดง 3,300 บาท
--
-- วิธีแก้: 
-- 1. เพิ่มคอลัมน์ base_shipping_cost เพื่อเก็บค่าขนส่งพื้นฐาน (ไม่รวมค่าเพิ่มเติม)
-- 2. shipping_cost = base_shipping_cost + porterage_fee + other_fees + extra_delivery_stops

-- เพิ่มคอลัมน์ base_shipping_cost ถ้ายังไม่มี
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'receiving_route_trips' 
        AND column_name = 'base_shipping_cost'
    ) THEN
        ALTER TABLE receiving_route_trips ADD COLUMN base_shipping_cost NUMERIC DEFAULT 0;
        COMMENT ON COLUMN receiving_route_trips.base_shipping_cost IS 'ค่าขนส่งพื้นฐาน (ไม่รวมค่าเพิ่มเติม) - ใช้ใน flat mode';
    END IF;
END $$;

-- อัปเดต trigger function ให้รวม extra_delivery_stops ด้วย (v2 - ไม่บวกซ้ำ)
CREATE OR REPLACE FUNCTION "public"."calculate_shipping_cost_formula"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_other_fees_total NUMERIC := 0;
    v_extra_delivery_stops_total NUMERIC := 0;
    v_fee JSONB;
    v_stop JSONB;
    v_base_cost NUMERIC := 0;
BEGIN
    -- คำนวณยอดรวมจาก other_fees
    IF NEW.other_fees IS NOT NULL AND jsonb_array_length(NEW.other_fees) > 0 THEN
        FOR v_fee IN SELECT jsonb_array_elements(NEW.other_fees)
        LOOP
            v_other_fees_total := v_other_fees_total + COALESCE((v_fee->>'amount')::numeric, 0);
        END LOOP;
    END IF;

    -- คำนวณยอดรวมจาก extra_delivery_stops (จุดส่งพิเศษที่ไม่มี order)
    IF NEW.extra_delivery_stops IS NOT NULL AND jsonb_array_length(NEW.extra_delivery_stops) > 0 THEN
        FOR v_stop IN SELECT jsonb_array_elements(NEW.extra_delivery_stops)
        LOOP
            v_extra_delivery_stops_total := v_extra_delivery_stops_total + COALESCE((v_stop->>'cost')::numeric, 0);
        END LOOP;
    END IF;

    -- คำนวณ shipping_cost ตามโหมด
    IF NEW.pricing_mode = 'formula' THEN
        -- Formula mode: base_price + helper_fee + (extra_stops × extra_stop_fee)
        v_base_cost := COALESCE(NEW.base_price, 0)
                     + COALESCE(NEW.helper_fee, 0)
                     + (COALESCE(NEW.extra_stops_count, 0) * COALESCE(NEW.extra_stop_fee, 0));
        
        -- shipping_cost รวมทุกอย่าง
        NEW.shipping_cost := v_base_cost
                           + COALESCE(NEW.porterage_fee, 0)
                           + v_other_fees_total
                           + v_extra_delivery_stops_total;
                           
    ELSIF NEW.pricing_mode = 'flat' THEN
        -- Flat mode: ใช้ base_shipping_cost เป็นค่าเหมาพื้นฐาน
        -- ⚠️ สำคัญ: ตรวจสอบว่า base_shipping_cost เปลี่ยนหรือไม่
        
        IF NEW.base_shipping_cost IS NOT NULL AND NEW.base_shipping_cost > 0 THEN
            -- มี base_shipping_cost แล้ว ใช้ค่านั้นคำนวณ
            v_base_cost := NEW.base_shipping_cost;
        ELSIF OLD IS NOT NULL AND OLD.base_shipping_cost IS NOT NULL AND OLD.base_shipping_cost > 0 THEN
            -- ใช้ค่าเดิม
            v_base_cost := OLD.base_shipping_cost;
            NEW.base_shipping_cost := OLD.base_shipping_cost;
        ELSE
            -- ยังไม่มี base_shipping_cost ให้ใช้ shipping_cost ที่ส่งมา
            v_base_cost := COALESCE(NEW.shipping_cost, 0);
            NEW.base_shipping_cost := v_base_cost;
        END IF;
        
        -- shipping_cost รวมทุกอย่าง = ค่าเหมาพื้นฐาน + ค่าเพิ่มเติม
        NEW.shipping_cost := v_base_cost
                           + COALESCE(NEW.porterage_fee, 0)
                           + v_other_fees_total
                           + v_extra_delivery_stops_total;
    END IF;

    RETURN NEW;
END;
$$;

-- อัปเดต trigger ให้ทำงานเมื่อ extra_delivery_stops เปลี่ยนด้วย
DROP TRIGGER IF EXISTS "trigger_calculate_shipping_cost_formula" ON "public"."receiving_route_trips";

CREATE TRIGGER "trigger_calculate_shipping_cost_formula" 
    BEFORE INSERT OR UPDATE OF "pricing_mode", "base_price", "helper_fee", "extra_stop_fee", "extra_stops_count", "porterage_fee", "other_fees", "extra_delivery_stops", "shipping_cost", "base_shipping_cost"
    ON "public"."receiving_route_trips" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."calculate_shipping_cost_formula"();

COMMENT ON FUNCTION "public"."calculate_shipping_cost_formula"() IS 'คำนวณค่าขนส่งอัตโนมัติ รวมค่าแบกน้ำหนัก ค่าอื่นๆ และจุดส่งพิเศษ (v2 - ไม่บวกซ้ำ)';

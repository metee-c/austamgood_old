-- Migration: Add porterage fee and custom other fees to receiving_route_trips
-- Created: 2025-01-23
-- Description: เพิ่มคอลัมน์ค่าแบกน้ำหนักและค่าใช้จ่ายอื่นๆ ที่ผู้ใช้สามารถกำหนดเองได้

-- ============================================================
-- 1. เพิ่มคอลัมน์ porterage_fee (ค่าแบกน้ำหนัก)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_trips'
        AND column_name = 'porterage_fee'
    ) THEN
        ALTER TABLE receiving_route_trips
        ADD COLUMN porterage_fee NUMERIC(12,2) DEFAULT 0 CHECK (porterage_fee >= 0);
    END IF;
END $$;

COMMENT ON COLUMN receiving_route_trips.porterage_fee IS 'ค่าแบกน้ำหนัก (บาท)';


-- ============================================================
-- 2. เพิ่มคอลัมน์ other_fees (ค่าใช้จ่ายอื่นๆ ที่กำหนดเอง)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_trips'
        AND column_name = 'other_fees'
    ) THEN
        ALTER TABLE receiving_route_trips
        ADD COLUMN other_fees JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN receiving_route_trips.other_fees IS 'ค่าใช้จ่ายอื่นๆ ที่ผู้ใช้กำหนดเอง (JSONB array) - รูปแบบ: [{"label": "ค่าทางด่วน", "amount": 100}, {"label": "ค่าจอดรถ", "amount": 50}]';


-- ============================================================
-- 3. อัปเดต Trigger คำนวณค่าขนส่งอัตโนมัติ
-- ============================================================

-- Drop trigger เดิมก่อน
DROP TRIGGER IF EXISTS trigger_calculate_shipping_cost_formula ON receiving_route_trips;

-- สร้าง function ใหม่ที่รวมค่าแบกน้ำหนักและค่าอื่นๆ
CREATE OR REPLACE FUNCTION calculate_shipping_cost_formula()
RETURNS TRIGGER AS $$
DECLARE
    v_other_fees_total NUMERIC := 0;
    v_fee JSONB;
BEGIN
    -- คำนวณยอดรวมจาก other_fees
    IF NEW.other_fees IS NOT NULL AND jsonb_array_length(NEW.other_fees) > 0 THEN
        FOR v_fee IN SELECT jsonb_array_elements(NEW.other_fees)
        LOOP
            v_other_fees_total := v_other_fees_total + COALESCE((v_fee->>'amount')::numeric, 0);
        END LOOP;
    END IF;

    -- คำนวณ shipping_cost ตามโหมด
    IF NEW.pricing_mode = 'formula' THEN
        -- Formula mode: base_price + helper_fee + (extra_stops × extra_stop_fee) + porterage_fee + other_fees
        NEW.shipping_cost := COALESCE(NEW.base_price, 0)
                           + COALESCE(NEW.helper_fee, 0)
                           + (COALESCE(NEW.extra_stops_count, 0) * COALESCE(NEW.extra_stop_fee, 0))
                           + COALESCE(NEW.porterage_fee, 0)
                           + v_other_fees_total;
    ELSIF NEW.pricing_mode = 'flat' THEN
        -- Flat mode: ใช้ shipping_cost ที่ผู้ใช้ใส่เข้ามา แต่ยังบวก porterage_fee และ other_fees ได้
        -- (ไม่แก้ไข shipping_cost ใน flat mode - ให้ผู้ใช้กรอกเอง)
        NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger ใหม่
CREATE TRIGGER trigger_calculate_shipping_cost_formula
    BEFORE INSERT OR UPDATE OF pricing_mode, base_price, helper_fee, extra_stop_fee, extra_stops_count, porterage_fee, other_fees
    ON receiving_route_trips
    FOR EACH ROW
    EXECUTE FUNCTION calculate_shipping_cost_formula();

COMMENT ON FUNCTION calculate_shipping_cost_formula() IS 'คำนวณค่าขนส่งอัตโนมัติในโหมด formula (รวมค่าแบกน้ำหนักและค่าอื่นๆ)';


-- ============================================================
-- 4. ตัวอย่างการใช้งาน
-- ============================================================

/*
-- ตัวอย่างที่ 1: Formula mode + ค่าแบกน้ำหนัก
UPDATE receiving_route_trips
SET
    pricing_mode = 'formula',
    base_price = 1700,
    helper_fee = 500,
    extra_stop_fee = 100,
    total_stops = 5,
    porterage_fee = 300
WHERE trip_id = 1;
-- ผลลัพธ์: shipping_cost = 1700 + 500 + (4 × 100) + 300 = 2900 บาท


-- ตัวอย่างที่ 2: Formula mode + ค่าแบกน้ำหนัก + ค่าอื่นๆ
UPDATE receiving_route_trips
SET
    pricing_mode = 'formula',
    base_price = 5000,
    helper_fee = 800,
    extra_stop_fee = 150,
    total_stops = 10,
    porterage_fee = 500,
    other_fees = '[
        {"label": "ค่าทางด่วน", "amount": 120},
        {"label": "ค่าจอดรถ", "amount": 50},
        {"label": "ค่าน้ำมันเพิ่ม", "amount": 200}
    ]'::jsonb
WHERE trip_id = 2;
-- ผลลัพธ์:
-- - base_price: 5000
-- - helper_fee: 800
-- - extra_stops: 9 × 150 = 1350
-- - porterage_fee: 500
-- - other_fees: 120 + 50 + 200 = 370
-- shipping_cost = 5000 + 800 + 1350 + 500 + 370 = 8020 บาท


-- ตัวอย่างที่ 3: Flat mode (ค่าเหมา)
UPDATE receiving_route_trips
SET
    pricing_mode = 'flat',
    shipping_cost = 8500
WHERE trip_id = 3;
-- ผลลัพธ์: shipping_cost = 8500 บาท (ตามที่กรอก)


-- ตัวอย่างการ query ค่าอื่นๆ
SELECT
    trip_id,
    shipping_cost,
    porterage_fee,
    other_fees,
    jsonb_array_length(other_fees) as other_fees_count
FROM receiving_route_trips
WHERE trip_id = 2;
*/


-- ============================================================
-- 5. สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- 1. ✅ เพิ่มคอลัมน์ porterage_fee (ค่าแบกน้ำหนัก)
-- 2. ✅ เพิ่มคอลัมน์ other_fees (JSONB array สำหรับค่าใช้จ่ายอื่นๆ ที่กำหนดเอง)
-- 3. ✅ อัปเดต trigger calculate_shipping_cost_formula() ให้รวมค่าใหม่
-- 4. ✅ รองรับการคำนวณค่าขนส่งแบบอัตโนมัติ (formula mode)

-- Migration: Remove variable cost columns from master_freight_rate
-- Created: 2025-01-23
-- Description: ลบคอลัมน์ค่าใช้จ่ายแปรผัน (variable costs) ออกจาก master_freight_rate
--              เนื่องจากค่าเหล่านี้ไม่ควรเป็น Master Data แต่ควรอยู่ใน Transaction Data
--              (receiving_route_trips) ที่สามารถแก้ไขได้ในแต่ละรอบการจัดส่ง

-- ============================================================
-- บริบท: ความแตกต่างระหว่าง Master Data vs Transaction Data
-- ============================================================
-- Master Data (master_freight_rate): เก็บค่าคงที่ตามเส้นทาง/จังหวัด ใช้เป็น Template
-- Transaction Data (receiving_route_trips): เก็บค่าจริงของแต่ละวัน รวมค่าที่แปรผัน

-- ============================================================
-- คอลัมน์ที่จะลบออก (ค่าแปรผัน - ไม่ควรอยู่ใน Master)
-- ============================================================
-- 1. porterage_fee - ค่าแบกน้ำหนัก (แปรผันตามงานแต่ละวัน)
-- 2. other_fees - ค่าใช้จ่ายอื่นๆ (แปรผันตามงานแต่ละวัน)
-- 3. min_charge - ค่าขนส่งขั้นต่ำ (ไม่จำเป็นใน Master)
-- 4. calculated_price_per_km - ราคาต่อกิโลเมตร (คำนวณได้ ไม่ต้องเก็บ)
-- 5. calculated_price_per_kg - ราคาต่อกิโลกรัม (คำนวณได้ ไม่ต้องเก็บ)
-- 6. calculated_price_per_pallet - ราคาต่อพาเลท (คำนวณได้ ไม่ต้องเก็บ)
-- 7. fuel_surcharge_rate - อัตราค่าน้ำมัน (แปรผันตามราคาน้ำมัน)

-- ============================================================
-- คอลัมน์ที่เก็บไว้ (ค่าคงที่ - เหมาะสมกับ Master Data)
-- ============================================================
-- ✅ carrier_id, route_name, origin/destination province/district
-- ✅ total_distance_km
-- ✅ pricing_mode (flat/formula)
-- ✅ base_price - ราคาหลัก (แบบเหมา) หรือราคาเริ่มต้น (แบบคำนวณ)
-- ✅ extra_drop_price - ค่าจุดส่งเพิ่ม (คงที่ตามเส้นทาง)
-- ✅ helper_price - ค่าเด็กติดรถ (คงที่ตามเส้นทาง)
-- ✅ price_unit, effective_start_date, effective_end_date, notes


-- ============================================================
-- 0. Drop dependent views ก่อน
-- ============================================================
DROP VIEW IF EXISTS active_freight_rates CASCADE;


-- ============================================================
-- 1. ลบคอลัมน์ porterage_fee
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'porterage_fee'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN porterage_fee;
        RAISE NOTICE 'Dropped column: porterage_fee';
    END IF;
END $$;


-- ============================================================
-- 2. ลบคอลัมน์ other_fees
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'other_fees'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN other_fees;
        RAISE NOTICE 'Dropped column: other_fees';
    END IF;
END $$;


-- ============================================================
-- 3. ลบคอลัมน์ min_charge
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'min_charge'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN min_charge;
        RAISE NOTICE 'Dropped column: min_charge';
    END IF;
END $$;


-- ============================================================
-- 4. ลบคอลัมน์ calculated_price_per_km
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'calculated_price_per_km'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN calculated_price_per_km;
        RAISE NOTICE 'Dropped column: calculated_price_per_km';
    END IF;
END $$;


-- ============================================================
-- 5. ลบคอลัมน์ calculated_price_per_kg
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'calculated_price_per_kg'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN calculated_price_per_kg;
        RAISE NOTICE 'Dropped column: calculated_price_per_kg';
    END IF;
END $$;


-- ============================================================
-- 6. ลบคอลัมน์ calculated_price_per_pallet
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'calculated_price_per_pallet'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN calculated_price_per_pallet;
        RAISE NOTICE 'Dropped column: calculated_price_per_pallet';
    END IF;
END $$;


-- ============================================================
-- 7. ลบคอลัมน์ fuel_surcharge_rate
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'fuel_surcharge_rate'
    ) THEN
        ALTER TABLE master_freight_rate
        DROP COLUMN fuel_surcharge_rate;
        RAISE NOTICE 'Dropped column: fuel_surcharge_rate';
    END IF;
END $$;


-- ============================================================
-- สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- ✅ ลบคอลัมน์ porterage_fee (ค่าแบกน้ำหนัก)
-- ✅ ลบคอลัมน์ other_fees (ค่าอื่นๆ)
-- ✅ ลบคอลัมน์ min_charge (ค่าขนส่งขั้นต่ำ)
-- ✅ ลบคอลัมน์ calculated_price_per_km (ราคาต่อกม.)
-- ✅ ลบคอลัมน์ calculated_price_per_kg (ราคาต่อกก.)
-- ✅ ลบคอลัมน์ calculated_price_per_pallet (ราคาต่อพาเลท)
-- ✅ ลบคอลัมน์ fuel_surcharge_rate (อัตราค่าน้ำมัน)

-- คอลัมน์ที่เหลือใน master_freight_rate:
-- - freight_rate_id (PK)
-- - carrier_id (ผู้ให้บริการ)
-- - route_name (เส้นทาง)
-- - origin_province, origin_district (ต้นทาง)
-- - destination_province, destination_district (ปลายทาง)
-- - total_distance_km (ระยะทาง)
-- - pricing_mode (โหมดราคา: flat/formula) -- เพิ่มใน migration 032
-- - base_price (ราคาหลัก)
-- - extra_drop_price (ค่าจุดเพิ่ม)
-- - helper_price (ค่าเด็กติดรถ)
-- - price_unit (หน่วย)
-- - effective_start_date, effective_end_date (วันที่มีผล)
-- - notes (หมายเหตุ)
-- - created_by, created_at, updated_at (ข้อมูลการสร้าง/แก้ไข)

-- หมายเหตุ:
-- คอลัมน์ที่ลบออกนี้ยังคงอยู่ในตาราง receiving_route_trips
-- ซึ่งเป็นที่เหมาะสมสำหรับการเก็บข้อมูลที่แปรผันในแต่ละรอบการจัดส่ง


-- ============================================================
-- 8. สร้าง view active_freight_rates ใหม่ (โดยไม่รวมคอลัมน์ที่ลบออก)
-- ============================================================
CREATE OR REPLACE VIEW active_freight_rates AS
SELECT
    freight_rate_id,
    carrier_id,
    route_name,
    origin_province,
    origin_district,
    destination_province,
    destination_district,
    total_distance_km,
    pricing_mode,
    base_price,
    extra_drop_price,
    helper_price,
    price_unit,
    effective_start_date,
    effective_end_date,
    notes,
    created_by,
    created_at,
    updated_at
FROM master_freight_rate
WHERE (effective_end_date IS NULL OR effective_end_date >= CURRENT_DATE)
  AND effective_start_date <= CURRENT_DATE;

COMMENT ON VIEW active_freight_rates IS 'View of currently active freight rates (excluding variable cost columns)';

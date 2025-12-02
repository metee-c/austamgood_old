-- Migration: Update master_freight_rate to support new pricing modes
-- Created: 2025-01-23
-- Description: เพิ่มฟิลด์ใหม่ใน master_freight_rate ให้รองรับการคิดค่าขนส่งแบบใหม่

-- ============================================================
-- 1. เพิ่มคอลัมน์ pricing_mode
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'pricing_mode'
    ) THEN
        ALTER TABLE master_freight_rate
        ADD COLUMN pricing_mode VARCHAR(20) DEFAULT 'flat' 
        CHECK (pricing_mode IN ('flat', 'formula'));
    END IF;
END $$;

COMMENT ON COLUMN master_freight_rate.pricing_mode IS 'โหมดการคิดราคา: flat (เหมา) หรือ formula (คำนวณ)';


-- ============================================================
-- 2. เพิ่มคอลัมน์ porterage_fee
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'porterage_fee'
    ) THEN
        ALTER TABLE master_freight_rate
        ADD COLUMN porterage_fee NUMERIC(12,2) DEFAULT 0 
        CHECK (porterage_fee >= 0);
    END IF;
END $$;

COMMENT ON COLUMN master_freight_rate.porterage_fee IS 'ค่าแบกน้ำหนัก (บาท)';


-- ============================================================
-- 3. เพิ่มคอลัมน์ other_fees
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'master_freight_rate'
        AND column_name = 'other_fees'
    ) THEN
        ALTER TABLE master_freight_rate
        ADD COLUMN other_fees JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN master_freight_rate.other_fees IS 'ค่าใช้จ่ายอื่นๆ ที่กำหนดเอง (JSONB array) - รูปแบบ: [{"label": "ค่าทางด่วน", "amount": 100}]';


-- ============================================================
-- 4. อัปเดตข้อมูลเดิมให้เป็น formula mode
-- ============================================================

-- ข้อมูลเดิมที่มี base_price, extra_drop_price, helper_price ให้เป็น formula mode
UPDATE master_freight_rate
SET pricing_mode = 'formula'
WHERE base_price > 0 
  AND (extra_drop_price > 0 OR helper_price > 0);


-- ============================================================
-- 5. ตัวอย่างการใช้งาน
-- ============================================================

/*
-- ตัวอย่างที่ 1: เพิ่มอัตราค่าขนส่งแบบเหมา (flat)
INSERT INTO master_freight_rate (
    carrier_id,
    route_name,
    origin_province,
    destination_province,
    total_distance_km,
    pricing_mode,
    base_price,
    porterage_fee,
    other_fees,
    price_unit,
    effective_start_date,
    created_by
) VALUES (
    '1',
    'กรุงเทพฯ-ภูเก็ต (เหมา)',
    'กรุงเทพมหานคร',
    'ภูเก็ต',
    850,
    'flat',
    15000,  -- ค่าเหมา
    500,    -- ค่าแบกน้ำหนัก
    '[{"label": "ค่าทางด่วน", "amount": 120}, {"label": "ค่าจอดรถ", "amount": 50}]'::jsonb,
    'trip',
    '2025-01-23',
    'admin'
);


-- ตัวอย่างที่ 2: เพิ่มอัตราค่าขนส่งแบบคำนวณ (formula)
INSERT INTO master_freight_rate (
    carrier_id,
    route_name,
    origin_province,
    destination_province,
    total_distance_km,
    pricing_mode,
    base_price,
    extra_drop_price,
    helper_price,
    porterage_fee,
    other_fees,
    price_unit,
    effective_start_date,
    created_by
) VALUES (
    '1',
    'กรุงเทพฯ-เชียงใหม่ (คำนวณ)',
    'กรุงเทพมหานคร',
    'เชียงใหม่',
    700,
    'formula',
    5000,   -- ราคาเริ่มต้น
    150,    -- ค่าจุดเพิ่ม
    800,    -- ค่าเด็กติดรถ
    300,    -- ค่าแบกน้ำหนัก
    '[{"label": "ค่าน้ำมันเพิ่ม", "amount": 200}]'::jsonb,
    'trip',
    '2025-01-23',
    'admin'
);


-- ตัวอย่างการ query
SELECT 
    freight_rate_id,
    route_name,
    pricing_mode,
    base_price,
    extra_drop_price,
    helper_price,
    porterage_fee,
    other_fees,
    jsonb_array_length(other_fees) as other_fees_count
FROM master_freight_rate
WHERE pricing_mode = 'formula';
*/


-- ============================================================
-- 6. สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- 1. ✅ เพิ่มคอลัมน์ pricing_mode (flat/formula)
-- 2. ✅ เพิ่มคอลัมน์ porterage_fee (ค่าแบกน้ำหนัก)
-- 3. ✅ เพิ่มคอลัมน์ other_fees (JSONB array สำหรับค่าใช้จ่ายอื่นๆ)
-- 4. ✅ อัปเดตข้อมูลเดิมให้เป็น formula mode
-- 5. ✅ รองรับการบันทึกอัตราค่าขนส่งทั้ง 2 แบบ

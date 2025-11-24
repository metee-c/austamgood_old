-- Migration: Fix freight rate trigger after removing calculated columns
-- Created: 2025-11-23
-- Description: ลบ trigger และ function ที่อ้างอิง calculated_price_per_km ซึ่งถูกลบไปแล้ว

-- ============================================================
-- 1. Drop trigger
-- ============================================================
DROP TRIGGER IF EXISTS calculate_freight_prices_trigger ON master_freight_rate;

-- ============================================================
-- 2. Drop function (เนื่องจากไม่มีประโยชน์แล้ว)
-- ============================================================
DROP FUNCTION IF EXISTS calculate_freight_derived_prices();

-- ============================================================
-- เสร็จสิ้น
-- ============================================================
-- ✅ ลบ trigger ที่พยายาม set calculated_price_per_km
-- ✅ ลบ function ที่ไม่ใช้งานแล้ว
-- ✅ ตอนนี้สามารถ INSERT ข้อมูลเข้า master_freight_rate ได้ปกติ

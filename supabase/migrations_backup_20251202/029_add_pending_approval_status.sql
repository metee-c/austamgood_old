-- Migration: Add Pending Approval Status to Route Plans
-- Description: เพิ่มสถานะ 'pending_approval' และ 'approved' สำหรับ workflow การอนุมัติใบว่าจ้าง
-- Date: 2025-01-23

-- ============================================================
-- 1. เพิ่มสถานะใหม่ให้ receiving_route_plan_status_enum
-- ============================================================

-- เพิ่ม 'pending_approval' - รออนุมัติ (หลังพิมพ์ใบว่าจ้าง รอผู้จัดการอนุมัติ)
ALTER TYPE receiving_route_plan_status_enum ADD VALUE IF NOT EXISTS 'pending_approval';

-- เพิ่ม 'approved' - อนุมัติแล้ว (ผู้จัดการอนุมัติใบว่าจ้างแล้ว)
ALTER TYPE receiving_route_plan_status_enum ADD VALUE IF NOT EXISTS 'approved';

-- อัปเดต Comment
COMMENT ON TYPE receiving_route_plan_status_enum IS 'สถานะของชุดแผนเส้นทางรับสินค้า (draft/optimizing/published/pending_approval/approved/ready_to_load/in_transit/completed/cancelled)';


-- ============================================================
-- 2. สรุป Status Flow ใหม่
-- ============================================================

/*
Route Plan Status Flow (อัปเดตใหม่):

draft (แบบร่าง)
  ↓ (ผู้ใช้กดย้ายสถานะเมื่อแก้ไขเสร็จ)
optimizing (กำลังคำนวณ - เปิดให้กรอกค่าขนส่ง)
  ↓ (อัตโนมัติเมื่อกรอกค่าขนส่งครบทุกเที่ยว)
published (เผยแพร่แล้ว - พร้อมพิมพ์ใบว่าจ้าง)
  ↓ (กดปุ่มพิมพ์ใบว่าจ้าง)
pending_approval (รออนุมัติ - รอผู้จัดการดูใบว่าจ้าง) [สถานะใหม่]
  ↓ (ผู้จัดการกดอนุมัติ)
approved (อนุมัติแล้ว) [สถานะใหม่]
  ↓ (Workflow เดิม - Picklist created)
ready_to_load (พร้อมขึ้นรถ)
  ↓
in_transit (กำลังจัดส่ง)
  ↓
completed (เสร็จสิ้น)

หมายเหตุ:
- สถานะ pending_approval และ approved ไม่กระทบ Workflow หน้าอื่น
- หน้าอื่น (Orders, Picklists, Loadlists) ยังใช้ trigger เดิม
- การเปลี่ยนสถานะ draft → optimizing ทำด้วยตนเอง (ไม่มี trigger)
- การเปลี่ยนสถานะ optimizing → published เกิดอัตโนมัติ (trigger ตรวจสอบค่าขนส่งครบ)
- การเปลี่ยนสถานะ published → pending_approval เกิดจากการกดพิมพ์ใบว่าจ้าง
- การเปลี่ยนสถานะ pending_approval → approved ทำโดยผู้จัดการ
*/


-- ============================================================
-- 3. เพิ่มคอลัมน์ติดตามการอนุมัติ (Optional)
-- ============================================================

-- เพิ่มคอลัมน์สำหรับเก็บข้อมูลการพิมพ์และอนุมัติ
DO $$
BEGIN
    -- คอลัมน์วันที่พิมพ์ใบว่าจ้าง
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_plans'
        AND column_name = 'printed_at'
    ) THEN
        ALTER TABLE receiving_route_plans
        ADD COLUMN printed_at TIMESTAMPTZ;
    END IF;

    -- คอลัมน์ผู้พิมพ์ใบว่าจ้าง
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_plans'
        AND column_name = 'printed_by'
    ) THEN
        ALTER TABLE receiving_route_plans
        ADD COLUMN printed_by UUID REFERENCES auth.users(id);
    END IF;

    -- คอลัมน์วันที่อนุมัติ
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_plans'
        AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE receiving_route_plans
        ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;

    -- คอลัมน์ผู้อนุมัติ
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'receiving_route_plans'
        AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE receiving_route_plans
        ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

COMMENT ON COLUMN receiving_route_plans.printed_at IS 'วันเวลาที่พิมพ์ใบว่าจ้าง';
COMMENT ON COLUMN receiving_route_plans.printed_by IS 'ผู้ใช้ที่พิมพ์ใบว่าจ้าง';
COMMENT ON COLUMN receiving_route_plans.approved_at IS 'วันเวลาที่อนุมัติใบว่าจ้าง';
COMMENT ON COLUMN receiving_route_plans.approved_by IS 'ผู้จัดการที่อนุมัติใบว่าจ้าง';


-- ============================================================
-- 4. สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- 1. ✅ เพิ่มสถานะ 'pending_approval' (รออนุมัติ)
-- 2. ✅ เพิ่มสถานะ 'approved' (อนุมัติแล้ว)
-- 3. ✅ เพิ่มคอลัมน์ printed_at, printed_by, approved_at, approved_by
-- 4. ✅ อัปเดต Comments สำหรับ Status Enum

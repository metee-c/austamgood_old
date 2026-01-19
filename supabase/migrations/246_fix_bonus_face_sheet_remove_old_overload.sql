-- ============================================================================
-- Migration: 246_fix_bonus_face_sheet_remove_old_overload.sql
-- Description: ลบ overload เก่าของ create_bonus_face_sheet_with_reservation
--              ที่ยังไม่มี ::TEXT casting และใช้ parameter เก่า
-- 
-- ปัญหา: มี 2 overloads ของฟังก์ชัน:
-- 1. เวอร์ชันเก่า - ใช้ p_loadlist_id, face_sheet_code (ไม่มี ::TEXT casting)
-- 2. เวอร์ชันใหม่ - ใช้ p_delivery_date, face_sheet_no (มี ::TEXT casting)
-- 
-- PostgreSQL เลือก overload ผิดตัว ทำให้เกิด LPAD type error
-- 
-- แก้ไข: ลบ overload เก่าออก เก็บแค่เวอร์ชันใหม่
-- ============================================================================

-- Drop the old overload (with p_loadlist_id parameter)
DROP FUNCTION IF EXISTS create_bonus_face_sheet_with_reservation(
    p_loadlist_id INTEGER,
    p_packages JSONB,
    p_created_by VARCHAR
);

-- Verify only the new overload remains
-- The new overload has these parameters:
-- p_delivery_date DATE,
-- p_packages JSONB,
-- p_warehouse_id VARCHAR DEFAULT 'WH001',
-- p_created_by VARCHAR DEFAULT 'System'

COMMENT ON FUNCTION create_bonus_face_sheet_with_reservation(DATE, JSONB, VARCHAR, VARCHAR) IS 
'สร้างใบปะหน้าของแถมพร้อมจองสต็อคแบบ atomic (Migration 246: ลบ overload เก่าแล้ว)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

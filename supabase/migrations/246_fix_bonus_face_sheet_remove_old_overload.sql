-- ============================================================================
-- Migration: 246_fix_bonus_face_sheet_lpad_type_error.sql
-- Description: แก้ไข LPAD type error ใน generate_bonus_face_sheet_no_with_lock()
-- 
-- ปัญหา: LPAD ต้องการ TEXT เป็น argument แรก แต่ได้รับ INTEGER
-- Error: function lpad(integer, integer, unknown) does not exist
-- 
-- แก้ไข: เพิ่ม ::TEXT casting ให้กับ expression ก่อนส่งเข้า LPAD
-- ============================================================================

-- Drop the old overload (with p_loadlist_id parameter) if exists
DROP FUNCTION IF EXISTS create_bonus_face_sheet_with_reservation(
    p_loadlist_id INTEGER,
    p_packages JSONB,
    p_created_by VARCHAR
);

-- Fix generate_bonus_face_sheet_no_with_lock() - Add ::TEXT casting
CREATE OR REPLACE FUNCTION generate_bonus_face_sheet_no_with_lock()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $function$
DECLARE
    v_face_sheet_no VARCHAR;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Try to acquire advisory lock (key = 1002 for bonus face sheets)
    -- This prevents concurrent transactions from generating duplicate numbers
    v_lock_acquired := pg_try_advisory_xact_lock(1002);
    
    IF NOT v_lock_acquired THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างเลขที่ใบปะหน้าของแถมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    END IF;
    
    -- ✅ FIXED: Cast to TEXT before LPAD
    SELECT 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
           LPAD((COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 17) AS INTEGER)), 0) + 1)::TEXT, 3, '0')
    INTO v_face_sheet_no
    FROM bonus_face_sheets
    WHERE face_sheet_no LIKE 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    RETURN v_face_sheet_no;
END;
$function$;

COMMENT ON FUNCTION generate_bonus_face_sheet_no_with_lock IS 
'สร้างเลขที่ใบปะหน้าของแถมพร้อม Advisory Lock (Migration 246: แก้ LPAD type error)';

-- Verify only the new overload remains
COMMENT ON FUNCTION create_bonus_face_sheet_with_reservation(DATE, JSONB, VARCHAR, VARCHAR) IS 
'สร้างใบปะหน้าของแถมพร้อมจองสต็อคแบบ atomic (Migration 246: แก้ LPAD type error)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

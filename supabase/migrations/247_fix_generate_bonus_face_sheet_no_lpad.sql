-- ============================================================================
-- Migration: 247_fix_generate_bonus_face_sheet_no_lpad.sql
-- Description: แก้ไข LPAD type error ใน generate_bonus_face_sheet_no_with_lock()
-- 
-- BUG: invalid input syntax for type integer: ""
-- 
-- สาเหตุ:
-- - ฟังก์ชัน generate_bonus_face_sheet_no_with_lock() ใช้ LPAD โดยไม่ cast เป็น TEXT
-- - LPAD(COALESCE(MAX(...), 0) + 1, 3, '0') ส่ง INTEGER เข้าไป
-- - ต้อง cast เป็น TEXT ก่อนส่งเข้า LPAD
-- 
-- แก้ไข:
-- - เพิ่ม ::TEXT หรือ CAST(...  AS TEXT) ก่อนเรียก LPAD
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_bonus_face_sheet_no_with_lock()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
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
    
    -- ✅ FIX: Cast to TEXT before LPAD + handle empty string with NULLIF
    -- BFS-20260119-001 = 16 chars, so SUBSTRING FROM 14 gets '001'
    SELECT 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
           LPAD(
               CAST(
                   COALESCE(
                       MAX(CAST(NULLIF(SUBSTRING(face_sheet_no FROM 14), '') AS INTEGER)),
                       0
                   ) + 1 
                   AS TEXT
               ),
               3,
               '0'
           )
    INTO v_face_sheet_no
    FROM bonus_face_sheets
    WHERE face_sheet_no LIKE 'BFS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    RETURN v_face_sheet_no;
END;
$$;

COMMENT ON FUNCTION generate_bonus_face_sheet_no_with_lock IS 
'สร้างเลขที่ใบปะหน้าของแถมพร้อม Advisory Lock - แก้ไข LPAD type error (Migration 247)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_bonus_face_sheet_no_with_lock TO anon, authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

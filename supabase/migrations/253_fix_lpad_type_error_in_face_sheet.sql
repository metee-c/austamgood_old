-- ============================================================================
-- Migration: 253_fix_lpad_type_error_in_face_sheet.sql
-- Description: แก้ไข lpad type error ใน generate_face_sheet_no_with_lock function
-- 
-- BUG: function lpad(integer, integer, unknown) does not exist
-- FIX: เปลี่ยน LPAD parameter ที่ 3 จาก '0' เป็น '0'::TEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_face_sheet_no_with_lock()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_face_sheet_no VARCHAR;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Try to acquire advisory lock (key = 1001 for face sheets)
    -- This prevents concurrent transactions from generating duplicate numbers
    v_lock_acquired := pg_try_advisory_xact_lock(1001);
    
    IF NOT v_lock_acquired THEN
        RAISE EXCEPTION 'ไม่สามารถสร้างเลขที่ใบปะหน้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    END IF;
    
    -- Generate face sheet number (fixed LPAD type)
    SELECT 'FS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
           LPAD((COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 16) AS INTEGER)), 0) + 1)::TEXT, 3, '0')
    INTO v_face_sheet_no
    FROM face_sheets
    WHERE face_sheet_no LIKE 'FS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    RETURN v_face_sheet_no;
END;
$$;

COMMENT ON FUNCTION generate_face_sheet_no_with_lock IS 
'สร้างเลขที่ใบปะหน้าพร้อม Advisory Lock เพื่อป้องกัน duplicate (Fixed LPAD type error)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_face_sheet_no_with_lock TO anon, authenticated, service_role;

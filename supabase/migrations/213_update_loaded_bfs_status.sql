-- Migration: Update BFS status from completed to loaded for already loaded BFS
-- Date: 2026-01-14
-- Description: BFS ที่โหลดไปแล้วแต่ยัง status = completed ให้เปลี่ยนเป็น loaded
--              เพื่อไม่ให้แสดงในแท็บ "จัดสินค้าเสร็จ" อีกต่อไป

-- อัพเดท BFS status จาก completed → loaded
UPDATE bonus_face_sheets
SET 
  status = 'loaded',
  updated_at = NOW()
WHERE face_sheet_no IN (
  'BFS-20260107-002',
  'BFS-20260107-003',
  'BFS-20260107-004',
  'BFS-20260107-006',
  'BFS-20260108-001',
  'BFS-20260113-005'
)
AND status = 'completed';

-- Log การเปลี่ยนแปลง
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % BFS from completed to loaded status', updated_count;
END $$;

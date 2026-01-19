-- Migration: Update BFS-only loadlists to completed status
-- Date: 2026-01-18
-- Purpose: อัปเดตสถานะใบโหลดที่มีเฉพาะ BFS (ไม่มี picklist/face sheet) 
--          และ BFS ทั้งหมดโหลดเสร็จแล้ว ให้เป็น 'completed'

-- อัปเดตใบโหลดที่:
-- 1. มีเฉพาะ BFS (ไม่มี picklist และ face sheet)
-- 2. BFS ทั้งหมดโหลดเสร็จแล้ว (loaded_at IS NOT NULL)
-- 3. สถานะยังเป็น 'loaded'

UPDATE loadlists l
SET 
  status = 'completed',
  updated_at = NOW()
WHERE l.id IN (
  SELECT l2.id
  FROM loadlists l2
  LEFT JOIN wms_loadlist_picklists lp ON l2.id = lp.loadlist_id
  LEFT JOIN loadlist_face_sheets lfs ON l2.id = lfs.loadlist_id
  WHERE l2.status = 'loaded'
    -- ไม่มี picklist และ face sheet
    AND NOT EXISTS (
      SELECT 1 FROM wms_loadlist_picklists 
      WHERE loadlist_id = l2.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM loadlist_face_sheets 
      WHERE loadlist_id = l2.id
    )
    -- มี BFS อย่างน้อย 1 ใบ
    AND EXISTS (
      SELECT 1 FROM wms_loadlist_bonus_face_sheets 
      WHERE loadlist_id = l2.id
    )
    -- BFS ทั้งหมดโหลดเสร็จแล้ว
    AND NOT EXISTS (
      SELECT 1 FROM wms_loadlist_bonus_face_sheets 
      WHERE loadlist_id = l2.id 
        AND loaded_at IS NULL
    )
);

-- แสดงผลลัพธ์
SELECT 
  'Updated BFS-only loadlists to completed' as message,
  COUNT(*) as updated_count
FROM loadlists l
WHERE l.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM wms_loadlist_picklists 
    WHERE loadlist_id = l.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM loadlist_face_sheets 
    WHERE loadlist_id = l.id
  )
  AND EXISTS (
    SELECT 1 FROM wms_loadlist_bonus_face_sheets 
    WHERE loadlist_id = l.id
  );

-- Migration: Add bfs_confirmed_to_staging column to loadlists
-- Purpose: Track whether BFS packages have been confirmed to move to staging area
-- Date: 2026-01-15

-- Add column to loadlists table
ALTER TABLE loadlists 
ADD COLUMN IF NOT EXISTS bfs_confirmed_to_staging VARCHAR(3) DEFAULT 'no';

-- Add comment
COMMENT ON COLUMN loadlists.bfs_confirmed_to_staging IS 'สถานะการยืนยันย้าย BFS ไปจุดพักรอโหลด: yes = ยืนยันแล้ว, no = ยังไม่ยืนยัน';

-- Update existing loadlists with BFS to 'yes' (already confirmed in the past)
UPDATE loadlists
SET bfs_confirmed_to_staging = 'yes'
WHERE id IN (
    SELECT DISTINCT ll.id
    FROM loadlists ll
    INNER JOIN wms_loadlist_bonus_face_sheets llbfs ON ll.id = llbfs.loadlist_id
    WHERE ll.created_at < NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_loadlists_bfs_confirmed 
ON loadlists(bfs_confirmed_to_staging) 
WHERE bfs_confirmed_to_staging = 'no';

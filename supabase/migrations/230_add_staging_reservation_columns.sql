-- Migration: 230_add_staging_reservation_columns.sql
-- Description: เพิ่ม staging_location_id และ loaded_at columns ใน reservation tables
--              เพื่อรองรับระบบตรวจสอบเอกสารก่อนโหลด (Document Verification for Loading)
-- Date: 2025-01-18
-- Related to: Document Verification Loading System
-- Requirements: 4.1, 5.4

-- ============================================================================
-- 1. เพิ่ม columns ใน picklist_item_reservations
-- ============================================================================

-- Drop columns if they exist (in case of re-running migration)
ALTER TABLE picklist_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id CASCADE,
  DROP COLUMN IF EXISTS loaded_at CASCADE;

-- Add columns with correct data type
ALTER TABLE picklist_item_reservations 
  ADD COLUMN staging_location_id VARCHAR(50),
  ADD COLUMN loaded_at TIMESTAMP WITH TIME ZONE;

-- เพิ่ม foreign key constraint
ALTER TABLE picklist_item_reservations
  ADD CONSTRAINT fk_picklist_staging_location
  FOREIGN KEY (staging_location_id)
  REFERENCES master_location(location_id)
  ON DELETE RESTRICT;

-- เพิ่ม comment
COMMENT ON COLUMN picklist_item_reservations.staging_location_id IS 
  'Location ID ของ Dispatch/Staging area หลังจากหยิบสินค้าแล้ว (NULL = ยังไม่ได้หยิบ)';

COMMENT ON COLUMN picklist_item_reservations.loaded_at IS 
  'วันเวลาที่โหลดสินค้าขึ้นรถแล้ว (NULL = ยังไม่ได้โหลด)';

-- ============================================================================
-- 2. เพิ่ม columns ใน face_sheet_item_reservations
-- ============================================================================

-- Drop columns if they exist (in case of re-running migration)
ALTER TABLE face_sheet_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id CASCADE,
  DROP COLUMN IF EXISTS loaded_at CASCADE;

-- Add columns with correct data type
ALTER TABLE face_sheet_item_reservations 
  ADD COLUMN staging_location_id VARCHAR(50),
  ADD COLUMN loaded_at TIMESTAMP WITH TIME ZONE;

-- เพิ่ม foreign key constraint
ALTER TABLE face_sheet_item_reservations
  ADD CONSTRAINT fk_face_sheet_staging_location
  FOREIGN KEY (staging_location_id)
  REFERENCES master_location(location_id)
  ON DELETE RESTRICT;

-- เพิ่ม comment
COMMENT ON COLUMN face_sheet_item_reservations.staging_location_id IS 
  'Location ID ของ Dispatch/Staging area หลังจากหยิบสินค้าแล้ว (NULL = ยังไม่ได้หยิบ)';

COMMENT ON COLUMN face_sheet_item_reservations.loaded_at IS 
  'วันเวลาที่โหลดสินค้าขึ้นรถแล้ว (NULL = ยังไม่ได้โหลด)';

-- ============================================================================
-- 3. เพิ่ม columns ใน bonus_face_sheet_item_reservations
-- ============================================================================

-- Drop columns if they exist (in case of re-running migration)
ALTER TABLE bonus_face_sheet_item_reservations 
  DROP COLUMN IF EXISTS staging_location_id CASCADE,
  DROP COLUMN IF EXISTS loaded_at CASCADE;

-- Add columns with correct data type
ALTER TABLE bonus_face_sheet_item_reservations 
  ADD COLUMN staging_location_id VARCHAR(50),
  ADD COLUMN loaded_at TIMESTAMP WITH TIME ZONE;

-- เพิ่ม foreign key constraint
ALTER TABLE bonus_face_sheet_item_reservations
  ADD CONSTRAINT fk_bonus_face_sheet_staging_location
  FOREIGN KEY (staging_location_id)
  REFERENCES master_location(location_id)
  ON DELETE RESTRICT;

-- เพิ่ม comment
COMMENT ON COLUMN bonus_face_sheet_item_reservations.staging_location_id IS 
  'Location ID ของ PQTD/MRTD/Prep Area/Dispatch หลังจากหยิบสินค้าแล้ว (NULL = ยังไม่ได้หยิบ)';

COMMENT ON COLUMN bonus_face_sheet_item_reservations.loaded_at IS 
  'วันเวลาที่โหลดสินค้าขึ้นรถแล้ว (NULL = ยังไม่ได้โหลด)';

-- ============================================================================
-- 4. อัปเดต status constraint เพื่อรองรับ 'loaded' status
-- ============================================================================

-- Picklist: อัปเดต valid_status constraint
ALTER TABLE picklist_item_reservations
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE picklist_item_reservations
  ADD CONSTRAINT valid_status CHECK (
    status IN ('reserved', 'picked', 'released', 'cancelled', 'loaded')
  );

-- Face Sheet: อัปเดต chk_status constraint
ALTER TABLE face_sheet_item_reservations
  DROP CONSTRAINT IF EXISTS chk_status;

ALTER TABLE face_sheet_item_reservations
  ADD CONSTRAINT chk_status CHECK (
    status IN ('reserved', 'picked', 'cancelled', 'loaded')
  );

-- Bonus Face Sheet: อัปเดต bonus_face_sheet_reservations_status_check constraint
ALTER TABLE bonus_face_sheet_item_reservations
  DROP CONSTRAINT IF EXISTS bonus_face_sheet_reservations_status_check;

ALTER TABLE bonus_face_sheet_item_reservations
  ADD CONSTRAINT bonus_face_sheet_reservations_status_check CHECK (
    status IN ('reserved', 'picked', 'cancelled', 'loaded')
  );

-- ============================================================================
-- 5. สร้าง indexes สำหรับ performance optimization
-- ============================================================================

-- Picklist indexes
CREATE INDEX IF NOT EXISTS idx_picklist_reservations_staging 
  ON picklist_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';

CREATE INDEX IF NOT EXISTS idx_picklist_reservations_loaded
  ON picklist_item_reservations(loaded_at)
  WHERE loaded_at IS NOT NULL;

-- Face Sheet indexes
CREATE INDEX IF NOT EXISTS idx_face_sheet_reservations_staging 
  ON face_sheet_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';

CREATE INDEX IF NOT EXISTS idx_face_sheet_reservations_loaded
  ON face_sheet_item_reservations(loaded_at)
  WHERE loaded_at IS NOT NULL;

-- Bonus Face Sheet indexes
CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_reservations_staging 
  ON bonus_face_sheet_item_reservations(staging_location_id, status) 
  WHERE status = 'picked';

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_reservations_loaded
  ON bonus_face_sheet_item_reservations(loaded_at)
  WHERE loaded_at IS NOT NULL;

-- ============================================================================
-- 6. Log completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 230 completed: Added staging_location_id and loaded_at columns to reservation tables';
  RAISE NOTICE '   - picklist_item_reservations: staging_location_id, loaded_at';
  RAISE NOTICE '   - face_sheet_item_reservations: staging_location_id, loaded_at';
  RAISE NOTICE '   - bonus_face_sheet_item_reservations: staging_location_id, loaded_at';
  RAISE NOTICE '   - Updated status constraints to include "loaded"';
  RAISE NOTICE '   - Created performance indexes';
END $$;

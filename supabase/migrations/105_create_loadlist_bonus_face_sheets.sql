-- Migration: 105_create_loadlist_bonus_face_sheets.sql
-- Description: สร้าง junction table สำหรับเชื่อมโยง loadlists กับ bonus_face_sheets
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Loadlist Integration
-- Logic: คัดลอก 100% จาก wms_loadlist_picklists structure

-- Create junction table
CREATE TABLE IF NOT EXISTS wms_loadlist_bonus_face_sheets (
  id BIGSERIAL PRIMARY KEY,
  loadlist_id BIGINT NOT NULL,
  bonus_face_sheet_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  loaded_at TIMESTAMP WITH TIME ZONE,

  -- Foreign key constraints
  CONSTRAINT fk_loadlist_bonus_fs_loadlist
    FOREIGN KEY (loadlist_id)
    REFERENCES loadlists(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_loadlist_bonus_fs_bonus_face_sheet
    FOREIGN KEY (bonus_face_sheet_id)
    REFERENCES bonus_face_sheets(id)
    ON DELETE CASCADE,

  -- Prevent duplicate entries
  CONSTRAINT uk_loadlist_bonus_face_sheet
    UNIQUE (loadlist_id, bonus_face_sheet_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loadlist_bonus_fs_loadlist
  ON wms_loadlist_bonus_face_sheets(loadlist_id);

CREATE INDEX IF NOT EXISTS idx_loadlist_bonus_fs_bonus_face_sheet
  ON wms_loadlist_bonus_face_sheets(bonus_face_sheet_id);

CREATE INDEX IF NOT EXISTS idx_loadlist_bonus_fs_created_at
  ON wms_loadlist_bonus_face_sheets(created_at);

-- Add comments
COMMENT ON TABLE wms_loadlist_bonus_face_sheets IS 'Junction table: เชื่อมโยง loadlists กับ bonus_face_sheets สำหรับการโหลดสินค้าของแถม';

COMMENT ON COLUMN wms_loadlist_bonus_face_sheets.loadlist_id IS 'ID ของ loadlist';
COMMENT ON COLUMN wms_loadlist_bonus_face_sheets.bonus_face_sheet_id IS 'ID ของ bonus face sheet';
COMMENT ON COLUMN wms_loadlist_bonus_face_sheets.created_by IS 'ผู้สร้างรายการ';
COMMENT ON COLUMN wms_loadlist_bonus_face_sheets.loaded_at IS 'วันเวลาที่โหลดเสร็จสิ้น';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 105 completed: Created loadlist-bonus_face_sheet junction table';
  RAISE NOTICE '   Table: wms_loadlist_bonus_face_sheets';
  RAISE NOTICE '   Indexes: 3 (loadlist_id, bonus_face_sheet_id, created_at)';
  RAISE NOTICE '   Pattern: Same as wms_loadlist_picklists';
END $$;

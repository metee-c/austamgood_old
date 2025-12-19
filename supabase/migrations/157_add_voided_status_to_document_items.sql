-- ============================================================================
-- Migration: 157_add_voided_status_to_document_items.sql
-- Description: เพิ่ม voided_at column และ status 'voided' ให้กับ document items
--              สำหรับ Partial Rollback
-- Date: 2024-12-19
-- ============================================================================

-- ============================================================================
-- STEP 1: เพิ่ม voided_at column ให้กับ picklist_items
-- ============================================================================

ALTER TABLE picklist_items 
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE picklist_items 
ADD COLUMN IF NOT EXISTS voided_by BIGINT;

ALTER TABLE picklist_items 
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- FK สำหรับ voided_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_picklist_items_voided_by' 
        AND table_name = 'picklist_items'
    ) THEN
        ALTER TABLE picklist_items 
        ADD CONSTRAINT fk_picklist_items_voided_by 
        FOREIGN KEY (voided_by) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: เพิ่ม voided_at column ให้กับ face_sheet_items
-- ============================================================================

ALTER TABLE face_sheet_items 
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE face_sheet_items 
ADD COLUMN IF NOT EXISTS voided_by BIGINT;

ALTER TABLE face_sheet_items 
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- FK สำหรับ voided_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_face_sheet_items_voided_by' 
        AND table_name = 'face_sheet_items'
    ) THEN
        ALTER TABLE face_sheet_items 
        ADD CONSTRAINT fk_face_sheet_items_voided_by 
        FOREIGN KEY (voided_by) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: เพิ่ม voided_at column ให้กับ bonus_face_sheet_items
-- ============================================================================

ALTER TABLE bonus_face_sheet_items 
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE bonus_face_sheet_items 
ADD COLUMN IF NOT EXISTS voided_by BIGINT;

ALTER TABLE bonus_face_sheet_items 
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- FK สำหรับ voided_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_bonus_face_sheet_items_voided_by' 
        AND table_name = 'bonus_face_sheet_items'
    ) THEN
        ALTER TABLE bonus_face_sheet_items 
        ADD CONSTRAINT fk_bonus_face_sheet_items_voided_by 
        FOREIGN KEY (voided_by) REFERENCES master_system_user(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: เพิ่ม status 'voided' ให้กับ picklist_item_status enum (ถ้ายังไม่มี)
-- ============================================================================

DO $$
BEGIN
    -- ตรวจสอบว่า enum มี 'voided' หรือยัง
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'picklist_item_status')
        AND enumlabel = 'voided'
    ) THEN
        ALTER TYPE picklist_item_status ADD VALUE IF NOT EXISTS 'voided';
        RAISE NOTICE 'Added voided status to picklist_item_status enum';
    ELSE
        RAISE NOTICE 'voided status already exists in picklist_item_status enum';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'picklist_item_status enum does not exist, skipping';
END $$;

-- ============================================================================
-- STEP 5: เพิ่ม released_at column ให้กับ reservation tables
-- ============================================================================

-- 5.1 picklist_item_reservations
ALTER TABLE picklist_item_reservations 
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE picklist_item_reservations 
ADD COLUMN IF NOT EXISTS released_by BIGINT;

ALTER TABLE picklist_item_reservations 
ADD COLUMN IF NOT EXISTS release_reason TEXT;

-- 5.2 face_sheet_item_reservations
ALTER TABLE face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS released_by BIGINT;

ALTER TABLE face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS release_reason TEXT;

-- 5.3 bonus_face_sheet_item_reservations
ALTER TABLE bonus_face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE bonus_face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS released_by BIGINT;

ALTER TABLE bonus_face_sheet_item_reservations 
ADD COLUMN IF NOT EXISTS release_reason TEXT;


-- ============================================================================
-- STEP 6: สร้าง Indexes สำหรับ voided items
-- ============================================================================

-- 6.1 Index สำหรับหา voided picklist_items
CREATE INDEX IF NOT EXISTS idx_picklist_items_voided 
ON picklist_items(voided_at) 
WHERE voided_at IS NOT NULL;

-- 6.2 Index สำหรับหา voided face_sheet_items
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_voided 
ON face_sheet_items(voided_at) 
WHERE voided_at IS NOT NULL;

-- 6.3 Index สำหรับหา voided bonus_face_sheet_items
CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_voided 
ON bonus_face_sheet_items(voided_at) 
WHERE voided_at IS NOT NULL;

-- 6.4 Index สำหรับหา released reservations
CREATE INDEX IF NOT EXISTS idx_picklist_item_reservations_released 
ON picklist_item_reservations(released_at) 
WHERE released_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_face_sheet_item_reservations_released 
ON face_sheet_item_reservations(released_at) 
WHERE released_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_item_reservations_released 
ON bonus_face_sheet_item_reservations(released_at) 
WHERE released_at IS NOT NULL;

-- ============================================================================
-- STEP 7: สร้าง Helper Functions
-- ============================================================================

-- 7.1 Function: หา empty picklists (ไม่มี active items)
CREATE OR REPLACE FUNCTION find_empty_picklists()
RETURNS TABLE(id BIGINT, picklist_code VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.picklist_code
    FROM picklists p
    WHERE p.status NOT IN ('voided', 'cancelled')
      AND NOT EXISTS (
          SELECT 1 FROM picklist_items pi
          WHERE pi.picklist_id = p.id
            AND (pi.status NOT IN ('voided', 'cancelled') OR pi.status IS NULL)
            AND pi.voided_at IS NULL
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Function: หา empty face_sheets
CREATE OR REPLACE FUNCTION find_empty_face_sheets()
RETURNS TABLE(id BIGINT, face_sheet_no VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT fs.id, fs.face_sheet_no
    FROM face_sheets fs
    WHERE fs.status NOT IN ('voided', 'cancelled')
      AND NOT EXISTS (
          SELECT 1 FROM face_sheet_items fsi
          WHERE fsi.face_sheet_id = fs.id
            AND (fsi.status NOT IN ('voided', 'cancelled') OR fsi.status IS NULL)
            AND fsi.voided_at IS NULL
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Function: หา empty bonus_face_sheets
CREATE OR REPLACE FUNCTION find_empty_bonus_face_sheets()
RETURNS TABLE(id BIGINT, face_sheet_no VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT bfs.id, bfs.face_sheet_no
    FROM bonus_face_sheets bfs
    WHERE bfs.status NOT IN ('voided', 'cancelled')
      AND NOT EXISTS (
          SELECT 1 FROM bonus_face_sheet_items bfsi
          WHERE bfsi.face_sheet_id = bfs.id
            AND (bfsi.status NOT IN ('voided', 'cancelled') OR bfsi.status IS NULL)
            AND bfsi.voided_at IS NULL
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 Function: หา empty loadlists
CREATE OR REPLACE FUNCTION find_empty_loadlists()
RETURNS TABLE(id BIGINT, loadlist_code VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT ll.id, ll.loadlist_code
    FROM loadlists ll
    WHERE ll.status NOT IN ('voided', 'cancelled')
      AND NOT EXISTS (
          SELECT 1 FROM loadlist_items li
          WHERE li.loadlist_id = ll.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM wms_loadlist_picklists wlp
          WHERE wlp.loadlist_id = ll.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM loadlist_face_sheets lfs
          WHERE lfs.loadlist_id = ll.id
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Add Comments
-- ============================================================================

COMMENT ON COLUMN picklist_items.voided_at IS 'เวลาที่ item ถูก void (จาก rollback)';
COMMENT ON COLUMN picklist_items.voided_by IS 'User ID ที่ทำการ void';
COMMENT ON COLUMN picklist_items.void_reason IS 'เหตุผลที่ void';

COMMENT ON COLUMN face_sheet_items.voided_at IS 'เวลาที่ item ถูก void (จาก rollback)';
COMMENT ON COLUMN face_sheet_items.voided_by IS 'User ID ที่ทำการ void';
COMMENT ON COLUMN face_sheet_items.void_reason IS 'เหตุผลที่ void';

COMMENT ON COLUMN bonus_face_sheet_items.voided_at IS 'เวลาที่ item ถูก void (จาก rollback)';
COMMENT ON COLUMN bonus_face_sheet_items.voided_by IS 'User ID ที่ทำการ void';
COMMENT ON COLUMN bonus_face_sheet_items.void_reason IS 'เหตุผลที่ void';

COMMENT ON COLUMN picklist_item_reservations.released_at IS 'เวลาที่ reservation ถูก release (จาก rollback)';
COMMENT ON COLUMN picklist_item_reservations.released_by IS 'User ID ที่ทำการ release';
COMMENT ON COLUMN picklist_item_reservations.release_reason IS 'เหตุผลที่ release';

COMMENT ON FUNCTION find_empty_picklists IS 'หา picklists ที่ไม่มี active items (สำหรับ void หลัง rollback)';
COMMENT ON FUNCTION find_empty_face_sheets IS 'หา face_sheets ที่ไม่มี active items';
COMMENT ON FUNCTION find_empty_bonus_face_sheets IS 'หา bonus_face_sheets ที่ไม่มี active items';
COMMENT ON FUNCTION find_empty_loadlists IS 'หา loadlists ที่ไม่มี items';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 157 completed: voided status columns added to document items';
END $$;

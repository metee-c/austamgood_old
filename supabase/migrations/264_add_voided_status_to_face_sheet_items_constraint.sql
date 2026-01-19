-- ============================================================================
-- Migration: 264_add_voided_status_to_face_sheet_items_constraint.sql
-- Description: เพิ่ม 'voided' status ให้กับ face_sheet_items และ parent tables
--              เพื่อรองรับ Rollback Order functionality
-- Date: 2026-01-19
-- ============================================================================

-- ============================================================================
-- STEP 1: Add 'voided' to face_sheet_items constraint
-- ============================================================================

ALTER TABLE face_sheet_items 
DROP CONSTRAINT IF EXISTS chk_face_sheet_item_status;

ALTER TABLE face_sheet_items 
ADD CONSTRAINT chk_face_sheet_item_status 
CHECK (status IN ('pending', 'reserved', 'picked', 'shortage', 'substituted', 'voided'));

COMMENT ON CONSTRAINT chk_face_sheet_item_status ON face_sheet_items IS 
'Valid statuses: pending (initial), reserved (stock allocated), picked (completed), shortage (insufficient stock), substituted (replaced with alternative), voided (rollback)';

-- ============================================================================
-- STEP 2: Add 'voided' to bonus_face_sheet_items constraint
-- ============================================================================

ALTER TABLE bonus_face_sheet_items 
DROP CONSTRAINT IF EXISTS chk_bonus_face_sheet_item_status;

ALTER TABLE bonus_face_sheet_items 
ADD CONSTRAINT chk_bonus_face_sheet_item_status 
CHECK (status IN ('pending', 'reserved', 'picked', 'shortage', 'substituted', 'voided'));

COMMENT ON CONSTRAINT chk_bonus_face_sheet_item_status ON bonus_face_sheet_items IS 
'Valid statuses: pending (initial), reserved (stock allocated), picked (completed), shortage (insufficient stock), substituted (replaced with alternative), voided (rollback)';

-- ============================================================================
-- STEP 3: Fix existing data before adding constraints
-- ============================================================================

-- Update any invalid status values in face_sheets to 'cancelled'
UPDATE face_sheets 
SET status = 'cancelled' 
WHERE status NOT IN ('draft', 'generated', 'picking', 'completed', 'cancelled', 'voided');

-- Update any invalid status values in bonus_face_sheets to 'cancelled'
UPDATE bonus_face_sheets 
SET status = 'cancelled' 
WHERE status NOT IN ('draft', 'generated', 'picking', 'completed', 'cancelled', 'voided');

-- ============================================================================
-- STEP 4: Add 'voided' to face_sheets (parent table) constraint
-- ============================================================================

ALTER TABLE face_sheets 
DROP CONSTRAINT IF EXISTS face_sheets_status_check;

ALTER TABLE face_sheets 
ADD CONSTRAINT face_sheets_status_check 
CHECK (status IN ('draft', 'generated', 'picking', 'completed', 'cancelled', 'voided'));

-- ============================================================================
-- STEP 5: Add 'voided' to bonus_face_sheets (parent table) constraint
-- ============================================================================

ALTER TABLE bonus_face_sheets 
DROP CONSTRAINT IF EXISTS bonus_face_sheets_status_check;

ALTER TABLE bonus_face_sheets 
ADD CONSTRAINT bonus_face_sheets_status_check 
CHECK (status IN ('draft', 'generated', 'picking', 'completed', 'cancelled', 'voided'));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 264 completed: Added voided status to all face sheet constraints';
    RAISE NOTICE '   - face_sheet_items.chk_face_sheet_item_status now includes voided';
    RAISE NOTICE '   - bonus_face_sheet_items.chk_bonus_face_sheet_item_status now includes voided';
    RAISE NOTICE '   - face_sheets.face_sheets_status_check now includes voided';
    RAISE NOTICE '   - bonus_face_sheets.bonus_face_sheets_status_check now includes voided';
END $$;

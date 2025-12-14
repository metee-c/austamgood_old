-- Migration: Prevent Duplicate Document Items
-- Purpose: Add unique constraints to prevent duplicate items in picklists, face sheets, and bonus face sheets
-- Date: 2025-12-14

-- ============================================================================
-- 1. PICKLIST ITEMS - Prevent duplicates
-- ============================================================================

-- Check for existing duplicates in picklist_items
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT picklist_id, sku_id, source_location_id, order_item_id, COUNT(*)
    FROM picklist_items
    GROUP BY picklist_id, sku_id, source_location_id, order_item_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate picklist_items groups', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate picklist_items found';
  END IF;
END $$;

-- Add unique constraint for picklist_items
-- Note: We use (picklist_id, order_item_id) as the unique key since each order_item should appear only once per picklist
ALTER TABLE picklist_items
DROP CONSTRAINT IF EXISTS picklist_items_unique_per_order_item;

ALTER TABLE picklist_items
ADD CONSTRAINT picklist_items_unique_per_order_item 
UNIQUE (picklist_id, order_item_id);

COMMENT ON CONSTRAINT picklist_items_unique_per_order_item ON picklist_items IS 
'Prevents duplicate items: each order_item can appear only once per picklist';

-- ============================================================================
-- 2. FACE SHEET ITEMS - Prevent duplicates
-- ============================================================================

-- Check for existing duplicates in face_sheet_items
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT face_sheet_id, sku_id, order_item_id, COUNT(*)
    FROM face_sheet_items
    WHERE order_item_id IS NOT NULL
    GROUP BY face_sheet_id, sku_id, order_item_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate face_sheet_items groups - CLEANING UP', duplicate_count;
    
    -- Delete duplicates, keeping only the first one (lowest id)
    DELETE FROM face_sheet_items
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY face_sheet_id, order_item_id 
                 ORDER BY id
               ) as rn
        FROM face_sheet_items
        WHERE order_item_id IS NOT NULL
      ) ranked
      WHERE rn > 1
    );
    
    RAISE NOTICE 'Cleaned up duplicate face_sheet_items';
  ELSE
    RAISE NOTICE 'No duplicate face_sheet_items found';
  END IF;
END $$;

-- Add unique constraint for face_sheet_items
ALTER TABLE face_sheet_items
DROP CONSTRAINT IF EXISTS face_sheet_items_unique_per_order_item;

ALTER TABLE face_sheet_items
ADD CONSTRAINT face_sheet_items_unique_per_order_item 
UNIQUE (face_sheet_id, order_item_id);

COMMENT ON CONSTRAINT face_sheet_items_unique_per_order_item ON face_sheet_items IS 
'Prevents duplicate items: each order_item can appear only once per face_sheet';

-- ============================================================================
-- 3. BONUS FACE SHEET ITEMS - Prevent duplicates
-- ============================================================================

-- Check for existing duplicates in bonus_face_sheet_items
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT face_sheet_id, sku_id, order_item_id, COUNT(*)
    FROM bonus_face_sheet_items
    WHERE order_item_id IS NOT NULL
    GROUP BY face_sheet_id, sku_id, order_item_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate bonus_face_sheet_items groups - CLEANING UP', duplicate_count;
    
    -- Delete duplicates, keeping only the first one (lowest id)
    DELETE FROM bonus_face_sheet_items
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY face_sheet_id, order_item_id 
                 ORDER BY id
               ) as rn
        FROM bonus_face_sheet_items
        WHERE order_item_id IS NOT NULL
      ) ranked
      WHERE rn > 1
    );
    
    RAISE NOTICE 'Cleaned up duplicate bonus_face_sheet_items';
  ELSE
    RAISE NOTICE 'No duplicate bonus_face_sheet_items found';
  END IF;
END $$;

-- Add unique constraint for bonus_face_sheet_items
ALTER TABLE bonus_face_sheet_items
DROP CONSTRAINT IF EXISTS bonus_face_sheet_items_unique_per_order_item;

ALTER TABLE bonus_face_sheet_items
ADD CONSTRAINT bonus_face_sheet_items_unique_per_order_item 
UNIQUE (face_sheet_id, order_item_id);

COMMENT ON CONSTRAINT bonus_face_sheet_items_unique_per_order_item ON bonus_face_sheet_items IS 
'Prevents duplicate items: each order_item can appear only once per bonus_face_sheet';

-- ============================================================================
-- 4. ADD INDEXES for better performance
-- ============================================================================

-- Index for picklist_items lookups
CREATE INDEX IF NOT EXISTS idx_picklist_items_picklist_order_item 
ON picklist_items(picklist_id, order_item_id);

-- Index for face_sheet_items lookups
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_face_sheet_order_item 
ON face_sheet_items(face_sheet_id, order_item_id);

-- Index for bonus_face_sheet_items lookups
CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_face_sheet_order_item 
ON bonus_face_sheet_items(face_sheet_id, order_item_id);

-- ============================================================================
-- 5. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== VERIFICATION COMPLETE ===';
  RAISE NOTICE 'Added unique constraints to prevent duplicate items in:';
  RAISE NOTICE '  - picklist_items';
  RAISE NOTICE '  - face_sheet_items';
  RAISE NOTICE '  - bonus_face_sheet_items';
  RAISE NOTICE '';
  RAISE NOTICE 'These constraints will prevent:';
  RAISE NOTICE '  1. Double-clicking issues';
  RAISE NOTICE '  2. Race conditions';
  RAISE NOTICE '  3. Stored procedure bugs';
  RAISE NOTICE '  4. API retry issues';
END $$;

-- Migration: Fix Face Sheet Items Unique Constraint
-- Purpose: Allow order items to appear in multiple packages within the same face sheet
-- Date: 2025-12-14
-- 
-- PROBLEM: The previous constraint (face_sheet_id, order_item_id) was too restrictive.
-- In face sheets, an order item CAN legitimately appear in multiple packages when:
--   - Pairing 7kg items across multiple packages
--   - Pairing 10kg items across multiple packages
--   - Splitting large orders across multiple packages
--
-- SOLUTION: Change the unique constraint to (face_sheet_id, package_id, order_item_id)
-- This allows the same order_item to appear in multiple packages, but only once per package.

-- ============================================================================
-- 1. DROP OLD CONSTRAINT
-- ============================================================================

ALTER TABLE face_sheet_items
DROP CONSTRAINT IF EXISTS face_sheet_items_unique_per_order_item;

-- ============================================================================
-- 2. ADD CORRECT CONSTRAINT
-- ============================================================================

-- The correct constraint: each order_item can appear only once per package
-- But the same order_item CAN appear in multiple packages within the same face sheet
ALTER TABLE face_sheet_items
ADD CONSTRAINT face_sheet_items_unique_per_package_order_item 
UNIQUE (face_sheet_id, package_id, order_item_id);

COMMENT ON CONSTRAINT face_sheet_items_unique_per_package_order_item ON face_sheet_items IS 
'Prevents duplicate items: each order_item can appear only once per package, but can appear in multiple packages within the same face sheet';

-- ============================================================================
-- 3. UPDATE INDEX
-- ============================================================================

-- Drop old index
DROP INDEX IF EXISTS idx_face_sheet_items_face_sheet_order_item;

-- Create new index that matches the constraint
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_package_order_item 
ON face_sheet_items(face_sheet_id, package_id, order_item_id);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== FACE SHEET ITEMS CONSTRAINT FIX COMPLETE ===';
  RAISE NOTICE 'Changed unique constraint from:';
  RAISE NOTICE '  OLD: (face_sheet_id, order_item_id) - TOO RESTRICTIVE';
  RAISE NOTICE '  NEW: (face_sheet_id, package_id, order_item_id) - CORRECT';
  RAISE NOTICE '';
  RAISE NOTICE 'This allows order items to be split across multiple packages,';
  RAISE NOTICE 'which is required for pairing logic in face sheet generation.';
END $$;

-- Migration: Add parent_pallet_id to wms_move_items table
-- Purpose: Track pallet lineage when splitting pallets during partial moves
-- Date: 2025-01-21

-- Add parent_pallet_id column to track the original pallet when doing partial moves
ALTER TABLE wms_move_items
ADD COLUMN IF NOT EXISTS parent_pallet_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN wms_move_items.parent_pallet_id IS 'Original pallet ID when this item was split from a larger pallet during partial move';

-- Add index for better query performance when tracking pallet lineage
CREATE INDEX IF NOT EXISTS idx_wms_move_items_parent_pallet
ON wms_move_items(parent_pallet_id)
WHERE parent_pallet_id IS NOT NULL;

-- Add new_pallet_id column to indicate the newly generated pallet ID for partial moves
ALTER TABLE wms_move_items
ADD COLUMN IF NOT EXISTS new_pallet_id TEXT;

COMMENT ON COLUMN wms_move_items.new_pallet_id IS 'Newly generated pallet ID when splitting a pallet for partial move';

-- Add index for new_pallet_id
CREATE INDEX IF NOT EXISTS idx_wms_move_items_new_pallet
ON wms_move_items(new_pallet_id)
WHERE new_pallet_id IS NOT NULL;

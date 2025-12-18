-- Migration: Add pallet_id to replenishment_queue for FEFO compliance
-- This allows specifying which exact pallet to pick when replenishing stock

-- Add pallet_id column to replenishment_queue
ALTER TABLE replenishment_queue
ADD COLUMN IF NOT EXISTS pallet_id TEXT;

-- Add expiry_date column to track the expiry date of the selected pallet
ALTER TABLE replenishment_queue
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Add index for faster lookups by pallet_id
CREATE INDEX IF NOT EXISTS idx_replenishment_queue_pallet_id 
ON replenishment_queue(pallet_id) 
WHERE pallet_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN replenishment_queue.pallet_id IS 'Specific pallet ID to pick from (FEFO - First Expiry First Out)';
COMMENT ON COLUMN replenishment_queue.expiry_date IS 'Expiry date of the selected pallet for FEFO tracking';

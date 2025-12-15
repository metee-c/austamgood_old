-- Migration: 148_create_adj_loss_location.sql
-- Purpose: Create ADJ-LOSS virtual location for stock adjustment tracking
-- Date: 2025-12-15
-- Author: System Auditor

-- Step 1: Add is_system_location column to master_location if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'master_location' AND column_name = 'is_system_location'
  ) THEN
    ALTER TABLE master_location
    ADD COLUMN is_system_location BOOLEAN DEFAULT false;

    COMMENT ON COLUMN master_location.is_system_location IS
      'ระบุว่าเป็น system/virtual location (true) หรือ physical location (false)';
  END IF;
END $$;

-- Step 2: Create ADJ-LOSS location
-- Note: Using 'bulk' as location_type since 'system' or 'virtual' doesn't exist in enum yet
INSERT INTO master_location (
  location_id,
  warehouse_id,
  location_code,
  location_name,
  location_type,
  max_capacity_qty,
  max_capacity_weight_kg,
  current_qty,
  current_weight_kg,
  active_status,
  is_system_location,
  putaway_strategy,
  zone,
  aisle,
  rack,
  shelf,
  bin,
  temperature_controlled,
  humidity_controlled,
  created_by,
  remarks
) VALUES (
  'LOC-ADJ-LOSS-001',
  'WH001', -- Default warehouse (adjust if needed)
  'ADJ-LOSS',
  'สถานที่จำลอง - บันทึกการปรับสต็อก (Virtual Location)',
  'bulk', -- Using existing enum value
  999999999, -- Unlimited capacity (max integer for qty)
  9999999.999, -- Unlimited weight (max for NUMERIC(10,3): 9999999.999)
  0, -- Current quantity
  0.0, -- Current weight
  'active',
  true, -- System location flag
  NULL, -- No putaway strategy needed
  'SYSTEM', -- Virtual zone
  NULL,
  NULL,
  NULL,
  NULL,
  false, -- Not temperature controlled
  false, -- Not humidity controlled
  'SYSTEM', -- Created by system
  'Virtual location for recording stock adjustments (increase/decrease). This location does not represent physical storage space.'
)
ON CONFLICT (location_id) DO NOTHING; -- Prevent duplicate if already exists

-- Step 3: Create index on is_system_location for faster queries
CREATE INDEX IF NOT EXISTS idx_master_location_is_system
ON master_location(is_system_location)
WHERE is_system_location = true;

-- Step 4: Add comment to explain ADJ-LOSS location
COMMENT ON TABLE master_location IS
  'Master location data. Includes both physical locations and virtual/system locations (e.g., ADJ-LOSS for stock adjustments).';

-- Verification query (for testing)
-- SELECT location_id, location_code, location_name, location_type, is_system_location, active_status
-- FROM master_location
-- WHERE location_code = 'ADJ-LOSS';

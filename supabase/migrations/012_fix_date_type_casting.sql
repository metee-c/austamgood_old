-- Migration: Fix date type casting for wms_inventory_ledger
-- Description: Ensure production_date and expiry_date can accept string inputs and convert to date

-- This migration doesn't change the schema but documents that the application
-- should handle date conversion at the application layer

-- Add helpful comment
COMMENT ON COLUMN wms_inventory_ledger.production_date IS 'วันที่ผลิต (DATE type - application should cast string to date)';
COMMENT ON COLUMN wms_inventory_ledger.expiry_date IS 'วันหมดอายุ (DATE type - application should cast string to date)';

-- Note: The actual fix should be in the application code where dates are inserted
-- Dates should be cast using ::date or TO_DATE() function in SQL queries

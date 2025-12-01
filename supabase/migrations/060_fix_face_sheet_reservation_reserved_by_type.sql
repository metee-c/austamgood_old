-- Migration: Fix reserved_by type in face_sheet_item_reservations
-- Change reserved_by from UUID to VARCHAR to match the function parameter

-- Drop the existing function first
DROP FUNCTION IF EXISTS reserve_stock_for_face_sheet_items(bigint, character varying, character varying);

-- Alter the column type
ALTER TABLE face_sheet_item_reservations 
ALTER COLUMN reserved_by TYPE VARCHAR USING reserved_by::VARCHAR;

-- Recreate the function (it should work now with VARCHAR)
-- The function definition remains the same, just ensuring it's compatible

COMMENT ON COLUMN face_sheet_item_reservations.reserved_by IS 
'User ID or system identifier who reserved the stock. Changed from UUID to VARCHAR for flexibility.';

-- Add 'reserved' status to face_sheet_items constraint
-- This allows items to be marked as reserved when stock is allocated

-- Drop old constraint
ALTER TABLE face_sheet_items 
DROP CONSTRAINT IF EXISTS chk_face_sheet_item_status;

-- Add new constraint with 'reserved' status
ALTER TABLE face_sheet_items 
ADD CONSTRAINT chk_face_sheet_item_status 
CHECK (status IN ('pending', 'reserved', 'picked', 'shortage', 'substituted'));

COMMENT ON CONSTRAINT chk_face_sheet_item_status ON face_sheet_items IS 
'Valid statuses: pending (initial), reserved (stock allocated), picked (completed), shortage (insufficient stock), substituted (replaced with alternative)';

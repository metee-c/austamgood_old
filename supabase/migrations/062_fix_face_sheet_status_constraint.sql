-- Fix face_sheets status constraint to include 'picking' and 'cancelled'
ALTER TABLE face_sheets 
DROP CONSTRAINT IF EXISTS face_sheets_status_check;

ALTER TABLE face_sheets 
ADD CONSTRAINT face_sheets_status_check 
CHECK (status IN ('draft', 'generated', 'picking', 'completed', 'cancelled'));

-- Also update bonus_face_sheets for consistency
ALTER TABLE bonus_face_sheets 
DROP CONSTRAINT IF EXISTS bonus_face_sheets_status_check;

ALTER TABLE bonus_face_sheets 
ADD CONSTRAINT bonus_face_sheets_status_check 
CHECK (status IN ('draft', 'generated', 'picking', 'completed', 'cancelled'));

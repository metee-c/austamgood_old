-- Fix loadlist vehicle_id data type mismatch
-- Change from varchar to bigint to match master_vehicle.vehicle_id

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS loadlist_details_with_face_sheets;

-- Step 2: Convert vehicle_id from varchar to bigint
ALTER TABLE loadlists 
ALTER COLUMN vehicle_id TYPE bigint 
USING CASE 
  WHEN vehicle_id IS NULL OR vehicle_id = '' THEN NULL
  ELSE vehicle_id::bigint
END;

-- Step 3: Add comment
COMMENT ON COLUMN loadlists.vehicle_id IS 'Foreign key to master_vehicle.vehicle_id (bigint)';

-- Step 4: Recreate the view with correct data type
CREATE OR REPLACE VIEW loadlist_details_with_face_sheets AS
SELECT 
  l.id AS loadlist_id,
  l.loadlist_code,
  l.status,
  l.vehicle_id,
  l.driver_employee_id,
  l.created_by,
  l.created_at,
  l.updated_at,
  (SELECT COUNT(*) FROM loadlist_picklists lp WHERE lp.loadlist_id = l.id) AS picklist_count,
  (SELECT COUNT(*) FROM loadlist_face_sheets lfs WHERE lfs.loadlist_id = l.id) AS face_sheet_count,
  (SELECT COALESCE(SUM(p.total_lines), 0) FROM loadlist_picklists lp JOIN picklists p ON lp.picklist_id = p.id WHERE lp.loadlist_id = l.id) AS picklist_total_lines,
  (SELECT COALESCE(SUM(fs.total_packages), 0) FROM loadlist_face_sheets lfs JOIN face_sheets fs ON lfs.face_sheet_id = fs.id WHERE lfs.loadlist_id = l.id) AS face_sheet_total_packages
FROM loadlists l;

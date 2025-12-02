-- Add Face Sheet support to Loadlist system
-- This allows Face Sheets to be included in Loadlists alongside Picklists

-- Recreate loadlist_picklists table if not exists
CREATE TABLE IF NOT EXISTS loadlist_picklists (
    loadlist_id BIGINT NOT NULL REFERENCES loadlists(id) ON DELETE CASCADE,
    picklist_id BIGINT NOT NULL REFERENCES picklists(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (loadlist_id, picklist_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_loadlist_picklists_loadlist ON loadlist_picklists(loadlist_id);
CREATE INDEX IF NOT EXISTS idx_loadlist_picklists_picklist ON loadlist_picklists(picklist_id);

-- Add comments
COMMENT ON TABLE loadlist_picklists IS 'Junction table linking loadlists with picklists';
COMMENT ON COLUMN loadlist_picklists.loadlist_id IS 'Reference to loadlist';
COMMENT ON COLUMN loadlist_picklists.picklist_id IS 'Reference to picklist';

-- Create junction table for loadlist-face_sheet relationship
CREATE TABLE IF NOT EXISTS loadlist_face_sheets (
    loadlist_id BIGINT NOT NULL REFERENCES loadlists(id) ON DELETE CASCADE,
    face_sheet_id BIGINT NOT NULL REFERENCES face_sheets(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (loadlist_id, face_sheet_id)
);

-- Create index for faster queries
CREATE INDEX idx_loadlist_face_sheets_loadlist ON loadlist_face_sheets(loadlist_id);
CREATE INDEX idx_loadlist_face_sheets_face_sheet ON loadlist_face_sheets(face_sheet_id);

-- Add comments
COMMENT ON TABLE loadlist_face_sheets IS 'Junction table linking loadlists with face sheets';
COMMENT ON COLUMN loadlist_face_sheets.loadlist_id IS 'Reference to loadlist';
COMMENT ON COLUMN loadlist_face_sheets.face_sheet_id IS 'Reference to face sheet';

-- Drop existing view if exists
DROP VIEW IF EXISTS loadlist_details_with_face_sheets;

-- Create view for loadlist details including face sheets
CREATE VIEW loadlist_details_with_face_sheets AS
SELECT 
    l.id as loadlist_id,
    l.loadlist_code,
    l.status,
    l.vehicle_id,
    l.driver_employee_id,
    l.created_by,
    l.created_at,
    l.updated_at,
    -- Picklist count
    (SELECT COUNT(*) FROM loadlist_picklists lp WHERE lp.loadlist_id = l.id) as picklist_count,
    -- Face sheet count
    (SELECT COUNT(*) FROM loadlist_face_sheets lfs WHERE lfs.loadlist_id = l.id) as face_sheet_count,
    -- Total items from picklists
    (SELECT COALESCE(SUM(p.total_lines), 0) 
     FROM loadlist_picklists lp 
     JOIN picklists p ON lp.picklist_id = p.id 
     WHERE lp.loadlist_id = l.id) as picklist_total_lines,
    -- Total packages from face sheets
    (SELECT COALESCE(SUM(fs.total_packages), 0) 
     FROM loadlist_face_sheets lfs 
     JOIN face_sheets fs ON lfs.face_sheet_id = fs.id 
     WHERE lfs.loadlist_id = l.id) as face_sheet_total_packages
FROM loadlists l;

COMMENT ON VIEW loadlist_details_with_face_sheets IS 'Loadlist summary including both picklists and face sheets';

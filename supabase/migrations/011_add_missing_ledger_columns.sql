-- Migration: Add missing columns to wms_inventory_ledger
-- Description: Add created_at and other missing timestamp columns

-- Add created_at column if not exists
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column if not exists
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add comments
COMMENT ON COLUMN wms_inventory_ledger.created_at IS 'วันที่สร้างรายการ';
COMMENT ON COLUMN wms_inventory_ledger.updated_at IS 'วันที่แก้ไขล่าสุด';

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_wms_inventory_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_wms_inventory_ledger_updated_at ON wms_inventory_ledger;

CREATE TRIGGER trg_update_wms_inventory_ledger_updated_at
    BEFORE UPDATE ON wms_inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_wms_inventory_ledger_updated_at();

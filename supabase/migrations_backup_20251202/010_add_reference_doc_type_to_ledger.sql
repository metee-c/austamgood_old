-- Migration: Add reference_doc_type and reference_doc_id columns to wms_inventory_ledger
-- Description: Add columns to track the type and ID of reference document

-- Add reference_doc_type column
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS reference_doc_type VARCHAR(50);

-- Add reference_doc_id column
ALTER TABLE wms_inventory_ledger 
ADD COLUMN IF NOT EXISTS reference_doc_id BIGINT;

-- Add comments
COMMENT ON COLUMN wms_inventory_ledger.reference_doc_type IS 'ประเภทของเอกสารอ้างอิง (เช่น PO, SO, Transfer Order, etc.)';
COMMENT ON COLUMN wms_inventory_ledger.reference_doc_id IS 'ID ของเอกสารอ้างอิง (เช่น receive_id, order_id, etc.)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wms_inventory_ledger_ref_doc_type 
ON wms_inventory_ledger(reference_doc_type);

CREATE INDEX IF NOT EXISTS idx_wms_inventory_ledger_ref_doc_id 
ON wms_inventory_ledger(reference_doc_id);

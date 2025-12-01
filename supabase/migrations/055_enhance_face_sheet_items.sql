-- ============================================================================
-- Migration: Enhance face_sheet_items for stock reservation
-- Description: เพิ่ม columns ที่จำเป็นสำหรับระบบจองและย้ายสต็อค
-- ============================================================================

-- Add columns to face_sheet_items
ALTER TABLE face_sheet_items
ADD COLUMN IF NOT EXISTS sku_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_location_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS quantity_to_pick NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS quantity_picked NUMERIC(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS uom VARCHAR(20);

-- Add comments
COMMENT ON COLUMN face_sheet_items.sku_id IS 'รหัส SKU (FK ไปยัง master_sku)';
COMMENT ON COLUMN face_sheet_items.source_location_id IS 'พื้นที่หยิบสินค้า (preparation area code)';
COMMENT ON COLUMN face_sheet_items.quantity_to_pick IS 'จำนวนที่ต้องหยิบ';
COMMENT ON COLUMN face_sheet_items.quantity_picked IS 'จำนวนที่หยิบแล้ว';
COMMENT ON COLUMN face_sheet_items.status IS 'สถานะ: pending, picked, shortage, substituted';
COMMENT ON COLUMN face_sheet_items.picked_at IS 'วันเวลาที่หยิบ';
COMMENT ON COLUMN face_sheet_items.uom IS 'หน่วยนับ';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_sku ON face_sheet_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_source_location ON face_sheet_items(source_location_id);
CREATE INDEX IF NOT EXISTS idx_face_sheet_items_status ON face_sheet_items(status);

-- Add FK constraint to master_sku
ALTER TABLE face_sheet_items
ADD CONSTRAINT fk_face_sheet_items_sku 
  FOREIGN KEY (sku_id) REFERENCES master_sku(sku_id) ON DELETE RESTRICT;

-- Update existing records: copy product_code to sku_id and quantity to quantity_to_pick
UPDATE face_sheet_items
SET 
  sku_id = product_code,
  quantity_to_pick = quantity,
  quantity_picked = 0,
  status = 'pending'
WHERE sku_id IS NULL;

-- Add status columns to face_sheets
ALTER TABLE face_sheets
ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picking_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN face_sheets.picking_started_at IS 'วันเวลาที่เริ่มหยิบ';
COMMENT ON COLUMN face_sheets.picking_completed_at IS 'วันเวลาที่หยิบเสร็จ';

-- Add check constraint for status
ALTER TABLE face_sheet_items
ADD CONSTRAINT chk_face_sheet_item_status 
  CHECK (status IN ('pending', 'picked', 'shortage', 'substituted'));

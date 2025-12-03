-- Migration: 100_enhance_bonus_face_sheet_items.sql
-- Description: เพิ่ม columns สำหรับระบบจองและย้ายสต็อคใน bonus_face_sheet_items
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Stock Reservation System

-- Add new columns for stock management
ALTER TABLE bonus_face_sheet_items
  ADD COLUMN IF NOT EXISTS sku_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source_location_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS quantity_to_pick NUMERIC(15,3),
  ADD COLUMN IF NOT EXISTS quantity_picked NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'ชิ้น';

-- Add check constraint for status
ALTER TABLE bonus_face_sheet_items
  DROP CONSTRAINT IF EXISTS bonus_face_sheet_items_status_check;

ALTER TABLE bonus_face_sheet_items
  ADD CONSTRAINT bonus_face_sheet_items_status_check
  CHECK (status IN ('pending', 'picking', 'picked', 'shortage', 'substituted'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_status
  ON bonus_face_sheet_items(status);

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_sku
  ON bonus_face_sheet_items(sku_id);

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_source_location
  ON bonus_face_sheet_items(source_location_id);

CREATE INDEX IF NOT EXISTS idx_bonus_face_sheet_items_face_sheet
  ON bonus_face_sheet_items(face_sheet_id);

-- Add foreign key to master_sku (if exists)
-- Note: Uncomment if all bonus items have SKU in master_sku
-- ALTER TABLE bonus_face_sheet_items
--   ADD CONSTRAINT fk_bonus_face_sheet_items_sku
--   FOREIGN KEY (sku_id) REFERENCES master_sku(sku_id)
--   ON DELETE RESTRICT;

-- Add comments
COMMENT ON COLUMN bonus_face_sheet_items.sku_id IS 'รหัสสินค้า (FK to master_sku) - เชื่อมกับ master data';
COMMENT ON COLUMN bonus_face_sheet_items.source_location_id IS 'พื้นที่เตรียมสินค้า (preparation area code) - ใช้สำหรับจองสต็อค';
COMMENT ON COLUMN bonus_face_sheet_items.quantity_to_pick IS 'จำนวนที่ต้องหยิบ (ชิ้น) - คำนวณจาก quantity';
COMMENT ON COLUMN bonus_face_sheet_items.quantity_picked IS 'จำนวนที่หยิบแล้ว (ชิ้น) - อัปเดตเมื่อหยิบจริง';
COMMENT ON COLUMN bonus_face_sheet_items.status IS 'สถานะการหยิบ: pending (รอหยิบ), picking (กำลังหยิบ), picked (หยิบแล้ว), shortage (สต็อคไม่พอ), substituted (ใช้สินค้าทดแทน)';
COMMENT ON COLUMN bonus_face_sheet_items.picked_at IS 'วันเวลาที่หยิบเสร็จ';
COMMENT ON COLUMN bonus_face_sheet_items.uom IS 'หน่วยนับ (ชิ้น, กก., กล่อง, ฯลฯ)';

-- Update existing records: copy quantity to quantity_to_pick
UPDATE bonus_face_sheet_items
SET quantity_to_pick = quantity
WHERE quantity_to_pick IS NULL;

-- Update existing records: try to match product_code to sku_id
UPDATE bonus_face_sheet_items bfsi
SET sku_id = ms.sku_id
FROM master_sku ms
WHERE bfsi.product_code = ms.sku_id
  AND bfsi.sku_id IS NULL;

-- Update existing records: set default source_location if SKU has default_location
UPDATE bonus_face_sheet_items bfsi
SET source_location_id = ms.default_location
FROM master_sku ms
WHERE bfsi.sku_id = ms.sku_id
  AND bfsi.source_location_id IS NULL
  AND ms.default_location IS NOT NULL;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 100 completed: Enhanced bonus_face_sheet_items with stock management columns';
END $$;

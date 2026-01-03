-- Migration: Add material production_date and expiry_date to production_receipt_materials
-- เก็บวันผลิต/วันหมดอายุของวัตถุดิบอาหารที่ใช้ในการผลิต เพื่อ traceability

-- Add material_production_date column (วันผลิตของวัตถุดิบอาหาร)
ALTER TABLE production_receipt_materials
ADD COLUMN IF NOT EXISTS material_production_date DATE;

COMMENT ON COLUMN production_receipt_materials.material_production_date IS 'วันผลิตของวัตถุดิบอาหารที่ใช้ในการผลิต (จาก pallet ที่เบิก)';

-- Add material_expiry_date column (วันหมดอายุของวัตถุดิบอาหาร)
ALTER TABLE production_receipt_materials
ADD COLUMN IF NOT EXISTS material_expiry_date DATE;

COMMENT ON COLUMN production_receipt_materials.material_expiry_date IS 'วันหมดอายุของวัตถุดิบอาหารที่ใช้ในการผลิต (จาก pallet ที่เบิก)';

-- Add pallet_id column (รหัส pallet ที่เบิก)
ALTER TABLE production_receipt_materials
ADD COLUMN IF NOT EXISTS pallet_id VARCHAR(100);

COMMENT ON COLUMN production_receipt_materials.pallet_id IS 'รหัส pallet ของวัตถุดิบอาหารที่เบิกมาใช้';

-- Create index for traceability queries
CREATE INDEX IF NOT EXISTS idx_receipt_materials_pallet_id 
    ON production_receipt_materials(pallet_id);

CREATE INDEX IF NOT EXISTS idx_receipt_materials_material_dates 
    ON production_receipt_materials(material_production_date, material_expiry_date);

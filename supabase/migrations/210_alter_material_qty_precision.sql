-- Migration: Increase material_qty precision from 3 to 5 decimal places
-- Reason: Users need to enter material quantities with 5 decimal places (e.g. 0.00123)

-- bom_sku.material_qty: numeric(10,3) -> numeric(10,5)
ALTER TABLE bom_sku
  ALTER COLUMN material_qty TYPE numeric(10,5);

-- material_requirements.material_qty_per_unit: numeric(10,3) -> numeric(10,5)
ALTER TABLE material_requirements
  ALTER COLUMN material_qty_per_unit TYPE numeric(10,5);

-- material_requirements.waste_qty_per_unit: numeric(10,3) -> numeric(10,5)
ALTER TABLE material_requirements
  ALTER COLUMN waste_qty_per_unit TYPE numeric(10,5);

-- Migration: Add DELIVERY-IN-PROGRESS location for loading process
-- Created: 2024-11-27
-- Description: Add delivery location type and create DELIVERY-IN-PROGRESS location
-- Note: DISPATCH location already exists at location_code = 'Dispatch'

-- 1. Drop existing constraint
ALTER TABLE master_location 
DROP CONSTRAINT IF EXISTS master_location_location_type_check;

-- 2. Add new constraint with dispatch and delivery types
ALTER TABLE master_location 
ADD CONSTRAINT master_location_location_type_check 
CHECK (location_type::text = ANY (ARRAY[
  'rack'::character varying,
  'floor'::character varying,
  'bulk'::character varying,
  'other'::character varying,
  'receiving'::character varying,
  'dispatch'::character varying,
  'delivery'::character varying
]::text[]));

-- 3. Update existing Dispatch location to use 'dispatch' type
UPDATE master_location 
SET 
  location_type = 'dispatch',
  location_name = 'Dispatch (พื้นที่รอจัดส่ง)',
  updated_at = NOW()
WHERE location_code = 'Dispatch';

-- 4. Insert DELIVERY-IN-PROGRESS location
INSERT INTO master_location (
  location_id,
  warehouse_id,
  warehouse_name,
  location_code,
  location_name,
  location_type,
  max_capacity_qty,
  max_capacity_weight_kg,
  current_qty,
  current_weight_kg,
  active_status,
  created_by,
  created_at,
  updated_at,
  remarks
) VALUES (
  'WH001-DELIVERY-IN-PROGRESS',
  'WH001',
  'คลังสินค้า - สมุทรปกราการ',
  'Delivery-In-Progress',
  'สินค้าระหว่างการจัดส่ง (In Transit)',
  'delivery',
  999999,
  999999.00,
  0,
  0.00,
  'active',
  'system',
  NOW(),
  NOW(),
  'สินค้าที่โหลดขึ้นรถแล้ว กำลังอยู่ระหว่างการจัดส่ง'
) ON CONFLICT (location_code) DO UPDATE SET
  location_type = 'delivery',
  location_name = 'สินค้าระหว่างการจัดส่ง (In Transit)',
  updated_at = NOW();

-- 5. Add comment
COMMENT ON COLUMN master_location.location_type IS 'Location type: rack, floor, bulk, receiving, dispatch, delivery, other';

-- 6. Verify locations exist
DO $$
DECLARE
  dispatch_count INTEGER;
  delivery_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dispatch_count FROM master_location WHERE location_code = 'Dispatch' AND location_type = 'dispatch';
  SELECT COUNT(*) INTO delivery_count FROM master_location WHERE location_code = 'Delivery-In-Progress';
  
  IF dispatch_count = 0 THEN
    RAISE WARNING 'DISPATCH location not updated properly';
  ELSE
    RAISE NOTICE 'DISPATCH location updated: OK';
  END IF;
  
  IF delivery_count = 0 THEN
    RAISE EXCEPTION 'Failed to create DELIVERY-IN-PROGRESS location';
  ELSE
    RAISE NOTICE 'DELIVERY-IN-PROGRESS location created: OK';
  END IF;
END $$;

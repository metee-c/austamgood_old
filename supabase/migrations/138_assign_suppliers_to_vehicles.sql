-- Migration: Assign suppliers to existing vehicles
-- Purpose: Populate supplier_id for vehicles to enable vehicle filtering by transport company

-- First, let's see what suppliers we have (for reference)
-- Uncomment to view suppliers:
-- SELECT supplier_id, supplier_code, supplier_name, supplier_type, service_category 
-- FROM master_supplier 
-- WHERE supplier_type = 'ขนส่ง' OR service_category LIKE '%ขนส่ง%';

-- Example: Assign all vehicles to the first transport supplier
-- Replace 'SVC001' with your actual supplier_id from master_supplier table

-- Option 1: Assign ALL vehicles to one supplier (if you only have one transport company)
-- UPDATE master_vehicle 
-- SET supplier_id = (
--   SELECT supplier_id 
--   FROM master_supplier 
--   WHERE supplier_type = 'ขนส่ง' OR service_category LIKE '%ขนส่ง%'
--   LIMIT 1
-- )
-- WHERE supplier_id IS NULL;

-- Option 2: Assign specific vehicles to specific suppliers
-- Example: Assign vehicles 1-5 to supplier SVC001
-- UPDATE master_vehicle 
-- SET supplier_id = 'SVC001' 
-- WHERE vehicle_id IN (1, 2, 3, 4, 5);

-- Option 3: Assign vehicles by vehicle_code pattern
-- Example: All vehicles starting with 'VH-A' belong to supplier SVC001
-- UPDATE master_vehicle 
-- SET supplier_id = 'SVC001' 
-- WHERE vehicle_code LIKE 'VH-A%';

-- INSTRUCTIONS:
-- 1. First, query your suppliers to find the correct supplier_id:
--    SELECT supplier_id, supplier_code, supplier_name FROM master_supplier;
--
-- 2. Then, uncomment and modify one of the UPDATE statements above
--    to assign vehicles to the correct supplier
--
-- 3. Run this migration

-- Diagnostic: Check what data we have
DO $$
DECLARE
  supplier_count INTEGER;
  vehicle_count INTEGER;
  unassigned_count INTEGER;
  first_supplier_id VARCHAR(50);
  updated_count INTEGER;
BEGIN
  -- Count transport suppliers
  SELECT COUNT(*) INTO supplier_count
  FROM master_supplier 
  WHERE supplier_type = 'ขนส่ง' OR service_category LIKE '%ขนส่ง%';
  
  RAISE NOTICE 'Transport suppliers found: %', supplier_count;
  
  -- Count active vehicles
  SELECT COUNT(*) INTO vehicle_count
  FROM master_vehicle 
  WHERE current_status = 'Active';
  
  RAISE NOTICE 'Active vehicles found: %', vehicle_count;
  
  -- Count unassigned vehicles
  SELECT COUNT(*) INTO unassigned_count
  FROM master_vehicle 
  WHERE supplier_id IS NULL AND current_status = 'Active';
  
  RAISE NOTICE 'Unassigned active vehicles: %', unassigned_count;
  
  -- If we have suppliers and unassigned vehicles, do the assignment
  IF supplier_count > 0 AND unassigned_count > 0 THEN
    -- Get first supplier
    SELECT supplier_id INTO first_supplier_id
    FROM master_supplier 
    WHERE supplier_type = 'ขนส่ง' OR service_category LIKE '%ขนส่ง%'
    ORDER BY supplier_id
    LIMIT 1;
    
    RAISE NOTICE 'Assigning vehicles to supplier: %', first_supplier_id;
    
    -- Do the update
    UPDATE master_vehicle 
    SET supplier_id = first_supplier_id
    WHERE supplier_id IS NULL AND current_status = 'Active';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Successfully assigned % vehicles to supplier %', updated_count, first_supplier_id;
  ELSIF supplier_count = 0 THEN
    RAISE NOTICE 'โš ๏ธ  No transport suppliers found! Please add a supplier with supplier_type = ''ขนส่ง'' first.';
  ELSIF unassigned_count = 0 THEN
    RAISE NOTICE 'โœ… All active vehicles already have suppliers assigned.';
  END IF;
END $$;

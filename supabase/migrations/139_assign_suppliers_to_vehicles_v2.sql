-- Migration: Assign suppliers to vehicles (with diagnostics)
-- Purpose: Populate supplier_id for vehicles to enable vehicle filtering by transport company

-- Diagnostic: Check what data we have and assign if possible
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
    RAISE NOTICE 'โœ… Successfully assigned % vehicles to supplier %', updated_count, first_supplier_id;
  ELSIF supplier_count = 0 THEN
    RAISE NOTICE 'โš ๏ธ  No transport suppliers found!';
    RAISE NOTICE 'Please add a supplier with supplier_type = ''ขนส่ง'' in master_supplier table.';
    RAISE NOTICE 'Or update existing supplier: UPDATE master_supplier SET supplier_type = ''ขนส่ง'' WHERE supplier_id = ''YOUR_SUPPLIER_ID'';';
  ELSIF unassigned_count = 0 THEN
    RAISE NOTICE 'โœ… All active vehicles already have suppliers assigned.';
  END IF;
END $$;

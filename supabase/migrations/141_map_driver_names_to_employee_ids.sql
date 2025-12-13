-- Migration: Map driver names from model column to driver_id
-- Description: Update driver_id based on matching first names in model column with master_employee

-- Update driver_id by matching model (driver name) with employee first_name
UPDATE master_vehicle mv
SET driver_id = me.employee_id
FROM master_employee me
WHERE mv.model = me.first_name
  AND me.position LIKE '%ขับรถ%'
  AND mv.current_status = 'Active';

-- Verify the mapping
SELECT 
  mv.vehicle_id,
  mv.plate_number,
  mv.model as driver_name_in_model,
  mv.driver_id,
  me.first_name || ' ' || me.last_name as matched_employee
FROM master_vehicle mv
LEFT JOIN master_employee me ON mv.driver_id = me.employee_id
WHERE mv.current_status = 'Active'
ORDER BY mv.vehicle_id;

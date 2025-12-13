-- Assign different drivers to vehicles
-- This will distribute drivers across vehicles more realistically

-- Driver IDs available:
-- 149: พัฒนพล ศรีชัย
-- 150: ครรชนะ ชาปัด
-- 151: โจโจ้ โนนพิมาย
-- 152: อัษฎาวุธ ทอนเสาร์

-- Example: Assign different drivers to first 20 vehicles
-- You can customize this based on your needs

-- Vehicles 1-5: Driver 149 (พัฒนพล ศรีชัย)
UPDATE master_vehicle 
SET driver_id = 149 
WHERE vehicle_id IN (4, 5, 6, 23, 24);

-- Vehicles 6-10: Driver 150 (ครรชนะ ชาปัด)
UPDATE master_vehicle 
SET driver_id = 150 
WHERE vehicle_id IN (25, 26, 27, 28, 29);

-- Vehicles 11-15: Driver 151 (โจโจ้ โนนพิมาย)
UPDATE master_vehicle 
SET driver_id = 151 
WHERE vehicle_id IN (30, 31, 32, 7, 8);

-- Vehicles 16-20: Driver 152 (อัษฎาวุธ ทอนเสาร์)
UPDATE master_vehicle 
SET driver_id = 152 
WHERE vehicle_id IN (9, 10, 11, 12, 13);

-- Remaining vehicles: Rotate through drivers
UPDATE master_vehicle 
SET driver_id = 149 
WHERE vehicle_id IN (14, 15, 16, 17);

UPDATE master_vehicle 
SET driver_id = 150 
WHERE vehicle_id IN (18, 19, 20, 21);

UPDATE master_vehicle 
SET driver_id = 151 
WHERE vehicle_id IN (22, 33, 34, 35);

-- Verify the changes
SELECT 
  mv.vehicle_id,
  mv.plate_number,
  mv.driver_id,
  me.first_name || ' ' || me.last_name as driver_name
FROM master_vehicle mv
LEFT JOIN master_employee me ON mv.driver_id = me.employee_id
WHERE mv.current_status = 'Active'
ORDER BY mv.vehicle_id;

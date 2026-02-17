-- Migration: 324_add_delete_contract_function.sql
-- Description: Function สำหรับลบใบว่าจ้าง พร้อมลบ junction records ตามไปด้วย

-- Function สำหรับลบใบว่าจ้าง (ลบ junction ตามไปด้วย)
CREATE OR REPLACE FUNCTION delete_transport_contract(
  p_contract_id BIGINT,
  p_contract_type VARCHAR(20)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted BOOLEAN := FALSE;
BEGIN
  -- Delete junction records first (ถึงแม้จะมี CASCADE แต่ทำเอง explicit ดีกว่า)
  DELETE FROM transport_contract_trips
  WHERE contract_id = p_contract_id AND contract_type = p_contract_type;

  -- Delete contract based on type
  IF p_contract_type = 'single' THEN
    DELETE FROM transport_contracts WHERE id = p_contract_id;
    IF FOUND THEN v_deleted := TRUE; END IF;
  ELSIF p_contract_type = 'multi' THEN
    DELETE FROM multi_plan_transport_contracts WHERE id = p_contract_id;
    IF FOUND THEN v_deleted := TRUE; END IF;
  END IF;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_transport_contract IS 'ลบใบว่าจ้างขนส่ง พร้อมลบ junction records ใน transport_contract_trips';

-- Helper function to check if a trip is already in a contract
CREATE OR REPLACE FUNCTION is_trip_in_contract(p_trip_id BIGINT)
RETURNS TABLE(
  is_in_contract BOOLEAN,
  contract_id BIGINT,
  contract_type VARCHAR(20),
  contract_no VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE,
    tct.contract_id,
    tct.contract_type,
    COALESCE(tc.contract_no, mptc.contract_no)
  FROM transport_contract_trips tct
  LEFT JOIN transport_contracts tc ON tct.contract_id = tc.id AND tct.contract_type = 'single'
  LEFT JOIN multi_plan_transport_contracts mptc ON tct.contract_id = mptc.id AND tct.contract_type = 'multi'
  WHERE tct.trip_id = p_trip_id;
  
  -- If no rows found, return FALSE
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::VARCHAR, NULL::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_trip_in_contract IS 'ตรวจสอบว่า trip อยู่ในใบว่าจ้างใดหรือไม่';

-- Function to get all trips in a contract
CREATE OR REPLACE FUNCTION get_contract_trips(p_contract_id BIGINT, p_contract_type VARCHAR(20))
RETURNS TABLE(
  trip_id BIGINT,
  plan_id BIGINT,
  supplier_id VARCHAR(50),
  daily_trip_number INTEGER,
  vehicle_id VARCHAR(50),
  driver_name VARCHAR(255),
  shipping_cost NUMERIC(12,2),
  included_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rrt.trip_id,
    rrt.plan_id,
    tct.supplier_id,
    rrt.daily_trip_number,
    rrt.vehicle_id,
    rrt.driver_name,
    rrt.shipping_cost,
    tct.included_at
  FROM transport_contract_trips tct
  JOIN receiving_route_trips rrt ON tct.trip_id = rrt.trip_id
  WHERE tct.contract_id = p_contract_id AND tct.contract_type = p_contract_type
  ORDER BY rrt.daily_trip_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_contract_trips IS 'ดึงรายการ trips ทั้งหมดในใบว่าจ้าง';

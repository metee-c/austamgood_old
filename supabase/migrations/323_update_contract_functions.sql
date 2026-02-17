-- Migration: 323_update_contract_functions.sql
-- Description: Update create_multi_plan_transport_contract function to support trip_ids
-- และเพิ่ม junction records เมื่อสร้างใบว่าจ้าง

-- Drop existing function and recreate with new signature
DROP FUNCTION IF EXISTS create_multi_plan_transport_contract(
  VARCHAR, BIGINT[], VARCHAR[], VARCHAR, INTEGER, NUMERIC, VARCHAR
);

-- Updated function with trip_ids support
CREATE OR REPLACE FUNCTION create_multi_plan_transport_contract(
  p_plan_ids BIGINT[],
  p_plan_codes VARCHAR[],
  p_trip_ids BIGINT[],  -- ⭐ เพิ่ม parameter สำหรับ trip IDs
  p_supplier_id VARCHAR(50),
  p_supplier_name VARCHAR(255),
  p_contract_date DATE,
  p_total_trips INTEGER,
  p_total_cost NUMERIC(12,2),
  p_printed_by VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  contract_no VARCHAR(50),
  id BIGINT,
  is_new BOOLEAN
) AS $$
DECLARE
  v_new_contract_no VARCHAR(50);
  v_new_id BIGINT;
  v_trip_id BIGINT;
  v_plan_id BIGINT;
BEGIN
  -- Generate contract number
  v_new_contract_no := generate_multi_plan_contract_no(p_contract_date);

  -- Insert contract
  INSERT INTO multi_plan_transport_contracts (
    contract_no, supplier_id, supplier_name, plan_ids, plan_codes,
    contract_date, total_trips, total_cost, printed_at, printed_by, created_at, updated_at
  ) VALUES (
    v_new_contract_no, p_supplier_id, p_supplier_name, p_plan_ids, p_plan_codes,
    p_contract_date, p_total_trips, p_total_cost, NOW(), p_printed_by, NOW(), NOW()
  ) RETURNING multi_plan_transport_contracts.id INTO v_new_id;

  -- ⭐ Insert junction records for each trip
  FOREACH v_trip_id IN ARRAY p_trip_ids LOOP
    -- Get plan_id for this trip
    SELECT rrt.plan_id INTO v_plan_id
    FROM receiving_route_trips rrt
    WHERE rrt.trip_id = v_trip_id;

    INSERT INTO transport_contract_trips (
      contract_id, contract_type, trip_id, plan_id, supplier_id
    ) VALUES (
      v_new_id, 'multi', v_trip_id, v_plan_id, p_supplier_id
    );
  END LOOP;

  RETURN QUERY SELECT v_new_contract_no, v_new_id, TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_multi_plan_transport_contract IS 'สร้างใบว่าจ้างขนส่งแบบหลายแผน พร้อมเชื่อม trips เข้ากับ junction table';

-- Update get_or_create_transport_contract to accept optional p_contract_date parameter
-- If provided, use it instead of plan_date
-- This allows specifying delivery date (e.g., plan_date + 1) for TC numbering

CREATE OR REPLACE FUNCTION get_or_create_transport_contract(
  p_plan_id BIGINT,
  p_supplier_id VARCHAR,
  p_supplier_name VARCHAR DEFAULT NULL,
  p_total_trips INTEGER DEFAULT 0,
  p_total_cost NUMERIC DEFAULT 0,
  p_printed_by VARCHAR DEFAULT NULL,
  p_contract_date DATE DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  contract_no VARCHAR,
  plan_id BIGINT,
  supplier_id VARCHAR,
  supplier_name VARCHAR,
  contract_date DATE,
  total_trips INTEGER,
  total_cost NUMERIC,
  is_new BOOLEAN
) AS $$
DECLARE
  v_existing RECORD;
  v_new_contract_no VARCHAR;
  v_contract_date DATE;
  v_id BIGINT;
BEGIN
  -- Check if contract already exists
  SELECT tc.* INTO v_existing
  FROM transport_contracts tc
  WHERE tc.plan_id = p_plan_id AND tc.supplier_id = p_supplier_id;

  IF FOUND THEN
    -- Return existing contract
    RETURN QUERY SELECT
      v_existing.id,
      v_existing.contract_no,
      v_existing.plan_id,
      v_existing.supplier_id,
      v_existing.supplier_name,
      v_existing.contract_date,
      v_existing.total_trips,
      v_existing.total_cost,
      false AS is_new;
  ELSE
    -- Use provided contract_date, or fall back to plan_date
    IF p_contract_date IS NOT NULL THEN
      v_contract_date := p_contract_date;
    ELSE
      SELECT rp.plan_date INTO v_contract_date
      FROM receiving_route_plans rp
      WHERE rp.plan_id = p_plan_id;

      IF v_contract_date IS NULL THEN
        v_contract_date := CURRENT_DATE;
      END IF;
    END IF;

    -- Generate new contract number
    v_new_contract_no := generate_transport_contract_no(v_contract_date);

    -- Insert new contract
    INSERT INTO transport_contracts (
      contract_no, plan_id, supplier_id, supplier_name,
      contract_date, total_trips, total_cost, printed_at, printed_by
    ) VALUES (
      v_new_contract_no, p_plan_id, p_supplier_id, p_supplier_name,
      v_contract_date, p_total_trips, p_total_cost, NOW(), p_printed_by
    ) RETURNING transport_contracts.id INTO v_id;

    -- Return new contract
    RETURN QUERY SELECT
      v_id,
      v_new_contract_no,
      p_plan_id,
      p_supplier_id,
      p_supplier_name,
      v_contract_date,
      p_total_trips,
      p_total_cost,
      true AS is_new;
  END IF;
END;
$$ LANGUAGE plpgsql;

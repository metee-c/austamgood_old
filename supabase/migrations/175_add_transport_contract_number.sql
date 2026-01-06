-- Add transport contract number to route plans
-- เลขเอกสารใบว่าจ้างจะ generate ต่อ supplier ต่อ plan

-- เพิ่ม table สำหรับเก็บเลขเอกสารใบว่าจ้าง
CREATE TABLE IF NOT EXISTS transport_contracts (
  id BIGSERIAL PRIMARY KEY,
  contract_no VARCHAR(50) NOT NULL UNIQUE,
  plan_id BIGINT NOT NULL REFERENCES receiving_route_plans(plan_id) ON DELETE CASCADE,
  supplier_id VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255),
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_trips INTEGER DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  printed_at TIMESTAMPTZ,
  printed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, supplier_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_transport_contracts_plan_id ON transport_contracts(plan_id);
CREATE INDEX IF NOT EXISTS idx_transport_contracts_supplier_id ON transport_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_transport_contracts_contract_date ON transport_contracts(contract_date);

-- Function to generate transport contract number
-- Format: TC-YYYYMMDD-XXX (XXX = running number per day)
CREATE OR REPLACE FUNCTION generate_transport_contract_no(p_contract_date DATE DEFAULT CURRENT_DATE)
RETURNS VARCHAR AS $$
DECLARE
  v_date_str VARCHAR;
  v_count INTEGER;
  v_contract_no VARCHAR;
BEGIN
  v_date_str := TO_CHAR(p_contract_date, 'YYYYMMDD');
  
  -- Count existing contracts for this date
  SELECT COUNT(*) + 1 INTO v_count
  FROM transport_contracts
  WHERE contract_date = p_contract_date;
  
  -- Generate contract number
  v_contract_no := 'TC-' || v_date_str || '-' || LPAD(v_count::TEXT, 3, '0');
  
  RETURN v_contract_no;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create transport contract
CREATE OR REPLACE FUNCTION get_or_create_transport_contract(
  p_plan_id BIGINT,
  p_supplier_id VARCHAR,
  p_supplier_name VARCHAR DEFAULT NULL,
  p_total_trips INTEGER DEFAULT 0,
  p_total_cost NUMERIC DEFAULT 0,
  p_printed_by VARCHAR DEFAULT NULL
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
    -- Get plan date for contract date
    SELECT rp.plan_date INTO v_contract_date
    FROM receiving_route_plans rp
    WHERE rp.plan_id = p_plan_id;
    
    IF v_contract_date IS NULL THEN
      v_contract_date := CURRENT_DATE;
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

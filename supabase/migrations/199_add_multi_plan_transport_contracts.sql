-- Add support for multi-plan transport contracts
-- เลขเอกสารใบว่าจ้างรวมหลายแผน: TCM-YYYYMMDD-XXX

-- Add table for multi-plan transport contracts
CREATE TABLE IF NOT EXISTS multi_plan_transport_contracts (
  id BIGSERIAL PRIMARY KEY,
  contract_no VARCHAR(50) NOT NULL UNIQUE,
  supplier_id VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255),
  plan_ids BIGINT[] NOT NULL, -- Array of plan_ids
  plan_codes VARCHAR[] NOT NULL, -- Array of plan_codes for reference
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_trips INTEGER DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  printed_at TIMESTAMPTZ,
  printed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_multi_plan_tc_supplier_id ON multi_plan_transport_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_multi_plan_tc_contract_date ON multi_plan_transport_contracts(contract_date);
CREATE INDEX IF NOT EXISTS idx_multi_plan_tc_plan_ids ON multi_plan_transport_contracts USING GIN(plan_ids);

-- Function to generate multi-plan transport contract number
-- Format: TCM-YYYYMMDD-XXX (XXX = running number per day)
CREATE OR REPLACE FUNCTION generate_multi_plan_contract_no(p_contract_date DATE DEFAULT CURRENT_DATE)
RETURNS VARCHAR AS $
DECLARE
  v_date_str VARCHAR;
  v_count INTEGER;
  v_contract_no VARCHAR;
BEGIN
  v_date_str := TO_CHAR(p_contract_date, 'YYYYMMDD');
  
  -- Count existing multi-plan contracts for this date
  SELECT COUNT(*) + 1 INTO v_count
  FROM multi_plan_transport_contracts
  WHERE contract_date = p_contract_date;
  
  -- Generate contract number with TCM prefix
  v_contract_no := 'TCM-' || v_date_str || '-' || LPAD(v_count::TEXT, 3, '0');
  
  RETURN v_contract_no;
END;
$ LANGUAGE plpgsql;

-- Function to create multi-plan transport contract
CREATE OR REPLACE FUNCTION create_multi_plan_transport_contract(
  p_supplier_id VARCHAR,
  p_plan_ids BIGINT[],
  p_plan_codes VARCHAR[],
  p_supplier_name VARCHAR DEFAULT NULL,
  p_total_trips INTEGER DEFAULT 0,
  p_total_cost NUMERIC DEFAULT 0,
  p_printed_by VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  contract_no VARCHAR,
  supplier_id VARCHAR,
  supplier_name VARCHAR,
  plan_ids BIGINT[],
  plan_codes VARCHAR[],
  contract_date DATE,
  total_trips INTEGER,
  total_cost NUMERIC
) AS $
DECLARE
  v_new_contract_no VARCHAR;
  v_contract_date DATE;
  v_id BIGINT;
BEGIN
  -- Use current date for contract date
  v_contract_date := CURRENT_DATE;
  
  -- Generate new contract number
  v_new_contract_no := generate_multi_plan_contract_no(v_contract_date);
  
  -- Insert new contract
  INSERT INTO multi_plan_transport_contracts (
    contract_no, supplier_id, supplier_name, plan_ids, plan_codes,
    contract_date, total_trips, total_cost, printed_at, printed_by
  ) VALUES (
    v_new_contract_no, p_supplier_id, p_supplier_name, p_plan_ids, p_plan_codes,
    v_contract_date, p_total_trips, p_total_cost, NOW(), p_printed_by
  ) RETURNING multi_plan_transport_contracts.id INTO v_id;
  
  -- Return new contract
  RETURN QUERY SELECT 
    v_id,
    v_new_contract_no,
    p_supplier_id,
    p_supplier_name,
    p_plan_ids,
    p_plan_codes,
    v_contract_date,
    p_total_trips,
    p_total_cost;
END;
$ LANGUAGE plpgsql;

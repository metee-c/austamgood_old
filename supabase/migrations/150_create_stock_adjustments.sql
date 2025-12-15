-- Migration: 150_create_stock_adjustments.sql
-- Purpose: Create stock adjustments header table
-- Date: 2025-12-15
-- Author: System Auditor

-- Step 1: Create stock adjustments header table
CREATE TABLE IF NOT EXISTS wms_stock_adjustments (
  adjustment_id BIGSERIAL PRIMARY KEY,
  adjustment_no VARCHAR(50) NOT NULL UNIQUE,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled')),
  warehouse_id VARCHAR(50) NOT NULL,
  reason_id INTEGER NOT NULL,
  adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reference_no VARCHAR(100),
  remarks TEXT,

  -- User tracking
  created_by BIGINT,
  approved_by BIGINT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by BIGINT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  completed_by BIGINT,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_by BIGINT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_adjustment_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES master_warehouse(warehouse_id),
  CONSTRAINT fk_adjustment_reason FOREIGN KEY (reason_id)
    REFERENCES wms_adjustment_reasons(reason_id),
  CONSTRAINT fk_adjustment_created_by FOREIGN KEY (created_by)
    REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_approved_by FOREIGN KEY (approved_by)
    REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_rejected_by FOREIGN KEY (rejected_by)
    REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_completed_by FOREIGN KEY (completed_by)
    REFERENCES master_system_user(user_id),
  CONSTRAINT fk_adjustment_cancelled_by FOREIGN KEY (cancelled_by)
    REFERENCES master_system_user(user_id)
);

-- Step 2: Add table comment
COMMENT ON TABLE wms_stock_adjustments IS
  'Stock adjustment documents (header). Records stock increase/decrease transactions.';

-- Step 3: Add column comments
COMMENT ON COLUMN wms_stock_adjustments.adjustment_no IS 'Unique adjustment document number (e.g., ADJ-202512-0001)';
COMMENT ON COLUMN wms_stock_adjustments.adjustment_type IS 'Type: increase or decrease';
COMMENT ON COLUMN wms_stock_adjustments.status IS 'Status: draft, pending_approval, approved, rejected, completed, cancelled';
COMMENT ON COLUMN wms_stock_adjustments.warehouse_id IS 'Warehouse where adjustment occurs';
COMMENT ON COLUMN wms_stock_adjustments.reason_id IS 'Reason code for adjustment';
COMMENT ON COLUMN wms_stock_adjustments.adjustment_date IS 'Date/time of adjustment';
COMMENT ON COLUMN wms_stock_adjustments.reference_no IS 'External reference number (optional)';
COMMENT ON COLUMN wms_stock_adjustments.remarks IS 'Additional notes/explanation';

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_no
ON wms_stock_adjustments(adjustment_no);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status
ON wms_stock_adjustments(status);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_type
ON wms_stock_adjustments(adjustment_type);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_warehouse
ON wms_stock_adjustments(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date
ON wms_stock_adjustments(adjustment_date);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_by
ON wms_stock_adjustments(created_by);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason
ON wms_stock_adjustments(reason_id);

-- Step 5: Create sequence for adjustment_no generation
CREATE SEQUENCE IF NOT EXISTS seq_adjustment_no START 1;

-- Step 6: Create function to generate adjustment_no
CREATE OR REPLACE FUNCTION generate_adjustment_no()
RETURNS VARCHAR(50) AS $$
DECLARE
  v_year VARCHAR(4);
  v_month VARCHAR(2);
  v_prefix VARCHAR(20);
  v_last_no VARCHAR(50);
  v_last_seq INTEGER;
  v_new_seq INTEGER;
  v_new_no VARCHAR(50);
BEGIN
  -- Get current year and month
  v_year := TO_CHAR(CURRENT_TIMESTAMP, 'YYYY');
  v_month := TO_CHAR(CURRENT_TIMESTAMP, 'MM');
  v_prefix := 'ADJ-' || v_year || v_month || '-';

  -- Find last adjustment number for this month
  SELECT adjustment_no INTO v_last_no
  FROM wms_stock_adjustments
  WHERE adjustment_no LIKE v_prefix || '%'
  ORDER BY adjustment_no DESC
  LIMIT 1;

  -- Extract sequence number
  IF v_last_no IS NOT NULL THEN
    v_last_seq := SUBSTRING(v_last_no FROM LENGTH(v_prefix) + 1)::INTEGER;
    v_new_seq := v_last_seq + 1;
  ELSE
    v_new_seq := 1;
  END IF;

  -- Generate new number with zero padding (4 digits)
  v_new_no := v_prefix || LPAD(v_new_seq::TEXT, 4, '0');

  RETURN v_new_no;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_wms_stock_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_adjustments_updated_at
  BEFORE UPDATE ON wms_stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_wms_stock_adjustments_updated_at();

-- Step 8: Create trigger to auto-generate adjustment_no if not provided
CREATE OR REPLACE FUNCTION auto_generate_adjustment_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.adjustment_no IS NULL OR NEW.adjustment_no = '' THEN
    NEW.adjustment_no := generate_adjustment_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_generate_adjustment_no
  BEFORE INSERT ON wms_stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_adjustment_no();

-- Verification query (for testing)
-- SELECT adjustment_id, adjustment_no, adjustment_type, status, warehouse_id,
--        reason_id, adjustment_date, created_by, created_at
-- FROM wms_stock_adjustments
-- ORDER BY adjustment_date DESC;

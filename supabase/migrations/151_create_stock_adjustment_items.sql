-- Migration: 151_create_stock_adjustment_items.sql
-- Purpose: Create stock adjustment items (detail) table
-- Date: 2025-12-15
-- Author: System Auditor

-- Step 1: Create stock adjustment items table
CREATE TABLE IF NOT EXISTS wms_stock_adjustment_items (
  adjustment_item_id BIGSERIAL PRIMARY KEY,
  adjustment_id BIGINT NOT NULL,
  line_no INTEGER NOT NULL,

  -- SKU and Location
  sku_id VARCHAR(50) NOT NULL,
  location_id VARCHAR(50) NOT NULL,
  pallet_id VARCHAR(100),
  pallet_id_external VARCHAR(100),

  -- Lot tracking
  lot_no VARCHAR(100),
  production_date DATE,
  expiry_date DATE,

  -- Quantities (before adjustment) - captured at creation time
  before_pack_qty INTEGER DEFAULT 0,
  before_piece_qty INTEGER DEFAULT 0,

  -- Adjustment quantities (positive for increase, negative for decrease)
  adjustment_pack_qty INTEGER DEFAULT 0,
  adjustment_piece_qty INTEGER NOT NULL,

  -- Quantities (after adjustment) - calculated: before + adjustment
  after_pack_qty INTEGER DEFAULT 0,
  after_piece_qty INTEGER DEFAULT 0,

  -- Ledger reference (after completion)
  ledger_id BIGINT,

  -- Item-level remarks
  remarks TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_adjustment_item_adjustment FOREIGN KEY (adjustment_id)
    REFERENCES wms_stock_adjustments(adjustment_id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_item_sku FOREIGN KEY (sku_id)
    REFERENCES master_sku(sku_id),
  CONSTRAINT fk_adjustment_item_location FOREIGN KEY (location_id)
    REFERENCES master_location(location_id),
  CONSTRAINT fk_adjustment_item_ledger FOREIGN KEY (ledger_id)
    REFERENCES wms_inventory_ledger(ledger_id),

  -- Unique constraint for line number within adjustment
  CONSTRAINT uq_adjustment_item_line UNIQUE (adjustment_id, line_no),

  -- Validation: adjustment_piece_qty cannot be zero
  CONSTRAINT chk_adjustment_qty_not_zero CHECK (adjustment_piece_qty != 0)
);

-- Step 2: Add table comment
COMMENT ON TABLE wms_stock_adjustment_items IS
  'Stock adjustment line items (detail). Each line represents an adjustment for a specific SKU/location/pallet.';

-- Step 3: Add column comments
COMMENT ON COLUMN wms_stock_adjustment_items.adjustment_id IS 'Reference to adjustment header';
COMMENT ON COLUMN wms_stock_adjustment_items.line_no IS 'Line number within adjustment document';
COMMENT ON COLUMN wms_stock_adjustment_items.sku_id IS 'SKU being adjusted';
COMMENT ON COLUMN wms_stock_adjustment_items.location_id IS 'Location where adjustment occurs';
COMMENT ON COLUMN wms_stock_adjustment_items.pallet_id IS 'Pallet ID (if pallet-level adjustment)';
COMMENT ON COLUMN wms_stock_adjustment_items.before_pack_qty IS 'Pack quantity before adjustment';
COMMENT ON COLUMN wms_stock_adjustment_items.before_piece_qty IS 'Piece quantity before adjustment';
COMMENT ON COLUMN wms_stock_adjustment_items.adjustment_pack_qty IS 'Pack quantity adjustment (can be negative)';
COMMENT ON COLUMN wms_stock_adjustment_items.adjustment_piece_qty IS 'Piece quantity adjustment (can be negative)';
COMMENT ON COLUMN wms_stock_adjustment_items.after_pack_qty IS 'Pack quantity after adjustment';
COMMENT ON COLUMN wms_stock_adjustment_items.after_piece_qty IS 'Piece quantity after adjustment';
COMMENT ON COLUMN wms_stock_adjustment_items.ledger_id IS 'Reference to ledger entry (after completion)';

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adjustment_items_adjustment
ON wms_stock_adjustment_items(adjustment_id);

CREATE INDEX IF NOT EXISTS idx_adjustment_items_sku
ON wms_stock_adjustment_items(sku_id);

CREATE INDEX IF NOT EXISTS idx_adjustment_items_location
ON wms_stock_adjustment_items(location_id);

CREATE INDEX IF NOT EXISTS idx_adjustment_items_pallet
ON wms_stock_adjustment_items(pallet_id)
WHERE pallet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adjustment_items_ledger
ON wms_stock_adjustment_items(ledger_id)
WHERE ledger_id IS NOT NULL;

-- Step 5: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_wms_stock_adjustment_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_adjustment_items_updated_at
  BEFORE UPDATE ON wms_stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION update_wms_stock_adjustment_items_updated_at();

-- Step 6: Create trigger to auto-calculate after quantities
CREATE OR REPLACE FUNCTION calculate_adjustment_after_qty()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate after quantities: before + adjustment
  NEW.after_pack_qty := COALESCE(NEW.before_pack_qty, 0) + COALESCE(NEW.adjustment_pack_qty, 0);
  NEW.after_piece_qty := COALESCE(NEW.before_piece_qty, 0) + COALESCE(NEW.adjustment_piece_qty, 0);

  -- Ensure non-negative after quantities
  IF NEW.after_pack_qty < 0 THEN
    RAISE EXCEPTION 'After pack quantity cannot be negative (before: %, adjustment: %)',
      NEW.before_pack_qty, NEW.adjustment_pack_qty;
  END IF;

  IF NEW.after_piece_qty < 0 THEN
    RAISE EXCEPTION 'After piece quantity cannot be negative (before: %, adjustment: %)',
      NEW.before_piece_qty, NEW.adjustment_piece_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_adjustment_after_qty
  BEFORE INSERT OR UPDATE ON wms_stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_adjustment_after_qty();

-- Verification query (for testing)
-- SELECT ai.adjustment_item_id, ai.adjustment_id, ai.line_no, ai.sku_id, ai.location_id,
--        ai.before_piece_qty, ai.adjustment_piece_qty, ai.after_piece_qty,
--        s.adjustment_no, s.adjustment_type, s.status
-- FROM wms_stock_adjustment_items ai
-- JOIN wms_stock_adjustments s ON ai.adjustment_id = s.adjustment_id
-- ORDER BY ai.adjustment_id, ai.line_no;

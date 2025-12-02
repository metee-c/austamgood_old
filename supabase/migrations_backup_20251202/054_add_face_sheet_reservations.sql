-- ============================================================================
-- Migration: Add face sheet item reservations table
-- Description: เพิ่มตารางสำหรับจองสต็อคของ face sheets (เหมือน picklist_item_reservations)
-- ============================================================================

-- Create face_sheet_item_reservations table
CREATE TABLE IF NOT EXISTS face_sheet_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  face_sheet_item_id BIGINT NOT NULL,
  balance_id BIGINT NOT NULL,
  reserved_piece_qty NUMERIC(18,2) NOT NULL DEFAULT 0,
  reserved_pack_qty NUMERIC(18,2) NOT NULL DEFAULT 0,
  reserved_by UUID,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved',
  picked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_face_sheet_item FOREIGN KEY (face_sheet_item_id) 
    REFERENCES face_sheet_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_balance FOREIGN KEY (balance_id) 
    REFERENCES wms_inventory_balances(balance_id) ON DELETE RESTRICT,
  CONSTRAINT chk_reserved_piece_qty CHECK (reserved_piece_qty >= 0),
  CONSTRAINT chk_reserved_pack_qty CHECK (reserved_pack_qty >= 0),
  CONSTRAINT chk_status CHECK (status IN ('reserved', 'picked', 'cancelled'))
);

-- Add comments
COMMENT ON TABLE face_sheet_item_reservations IS 'ตารางเก็บข้อมูลการจองสต็อคสำหรับ face sheet items';
COMMENT ON COLUMN face_sheet_item_reservations.face_sheet_item_id IS 'FK ไปยัง face_sheet_items';
COMMENT ON COLUMN face_sheet_item_reservations.balance_id IS 'FK ไปยัง wms_inventory_balances ที่จองไว้';
COMMENT ON COLUMN face_sheet_item_reservations.reserved_piece_qty IS 'จำนวนชิ้นที่จอง';
COMMENT ON COLUMN face_sheet_item_reservations.reserved_pack_qty IS 'จำนวนแพ็คที่จอง';
COMMENT ON COLUMN face_sheet_item_reservations.status IS 'สถานะการจอง: reserved, picked, cancelled';

-- Create indexes
CREATE INDEX idx_face_sheet_item_reservations_item ON face_sheet_item_reservations(face_sheet_item_id);
CREATE INDEX idx_face_sheet_item_reservations_balance ON face_sheet_item_reservations(balance_id);
CREATE INDEX idx_face_sheet_item_reservations_status ON face_sheet_item_reservations(status);

-- Add updated_at trigger
CREATE TRIGGER update_face_sheet_item_reservations_updated_at
  BEFORE UPDATE ON face_sheet_item_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add checker and picker employee columns to face_sheets table
ALTER TABLE face_sheets
ADD COLUMN IF NOT EXISTS checker_employee_ids BIGINT[],
ADD COLUMN IF NOT EXISTS picker_employee_ids BIGINT[];

COMMENT ON COLUMN face_sheets.checker_employee_ids IS 'รายการ employee_id ของพนักงานเช็ค (array)';
COMMENT ON COLUMN face_sheets.picker_employee_ids IS 'รายการ employee_id ของพนักงานจัดสินค้า (array)';

-- Create indexes for employee arrays
CREATE INDEX IF NOT EXISTS idx_face_sheets_checker_employees ON face_sheets USING GIN (checker_employee_ids);
CREATE INDEX IF NOT EXISTS idx_face_sheets_picker_employees ON face_sheets USING GIN (picker_employee_ids);

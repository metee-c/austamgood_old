-- Migration: 102_create_bonus_face_sheet_reservations.sql
-- Description: สร้างตารางสำหรับจองสต็อคของรายการสินค้าในใบปะหน้าของแถม
-- Date: 2025-12-02
-- Related to: Bonus Face Sheet Stock Reservation System

-- Create reservations table
CREATE TABLE IF NOT EXISTS bonus_face_sheet_item_reservations (
  reservation_id BIGSERIAL PRIMARY KEY,
  bonus_face_sheet_item_id BIGINT NOT NULL,
  balance_id BIGINT NOT NULL,
  reserved_piece_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_pack_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_by VARCHAR(100),
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'reserved',
  picked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bonus_face_sheet_item
    FOREIGN KEY (bonus_face_sheet_item_id)
    REFERENCES bonus_face_sheet_items(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_inventory_balance
    FOREIGN KEY (balance_id)
    REFERENCES wms_inventory_balances(balance_id)
    ON DELETE RESTRICT,

  CONSTRAINT bonus_face_sheet_reservations_status_check
    CHECK (status IN ('reserved', 'picked', 'cancelled')),

  CONSTRAINT bonus_face_sheet_reservations_qty_check
    CHECK (reserved_piece_qty >= 0 AND reserved_pack_qty >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_bonus_fs_reservations_item
  ON bonus_face_sheet_item_reservations(bonus_face_sheet_item_id);

CREATE INDEX idx_bonus_fs_reservations_balance
  ON bonus_face_sheet_item_reservations(balance_id);

CREATE INDEX idx_bonus_fs_reservations_status
  ON bonus_face_sheet_item_reservations(status);

CREATE INDEX idx_bonus_fs_reservations_reserved_by
  ON bonus_face_sheet_item_reservations(reserved_by);

CREATE INDEX idx_bonus_fs_reservations_reserved_at
  ON bonus_face_sheet_item_reservations(reserved_at);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_bonus_face_sheet_reservations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_bonus_face_sheet_reservations_timestamp
  BEFORE UPDATE ON bonus_face_sheet_item_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_bonus_face_sheet_reservations_updated_at();

-- Add comments
COMMENT ON TABLE bonus_face_sheet_item_reservations IS 'การจองสต็อคสำหรับรายการสินค้าในใบปะหน้าของแถม - เก็บ balance_id ที่จองไว้เพื่อใช้ตอนหยิบจริง';

COMMENT ON COLUMN bonus_face_sheet_item_reservations.reservation_id IS 'รหัสการจอง (Primary Key)';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.bonus_face_sheet_item_id IS 'FK to bonus_face_sheet_items - รายการสินค้าที่จอง';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.balance_id IS 'FK to wms_inventory_balances - Balance ที่จองไว้ (ใช้ balance_id นี้ตอนหยิบจริง)';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.reserved_piece_qty IS 'จำนวนที่จอง (ชิ้น) - ลดเมื่อหยิบ';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.reserved_pack_qty IS 'จำนวนที่จอง (แพ็ค) - คำนวณจาก piece_qty / qty_per_pack';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.reserved_by IS 'ผู้ทำการจอง (user ID หรือ System)';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.reserved_at IS 'วันเวลาที่จอง';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.status IS 'สถานะ: reserved (จองแล้ว), picked (หยิบแล้ว), cancelled (ยกเลิก)';
COMMENT ON COLUMN bonus_face_sheet_item_reservations.picked_at IS 'วันเวลาที่หยิบสินค้า';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 102 completed: Created bonus_face_sheet_item_reservations table';
END $$;

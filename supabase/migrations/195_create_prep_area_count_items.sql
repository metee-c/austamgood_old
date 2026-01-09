-- Migration: Create prep area count items table
-- สร้างตารางสำหรับเก็บรายการนับสต็อกบ้านหยิบ

-- เพิ่ม count_type column ใน wms_stock_count_sessions ถ้ายังไม่มี
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wms_stock_count_sessions' 
    AND column_name = 'count_type'
  ) THEN
    ALTER TABLE wms_stock_count_sessions 
    ADD COLUMN count_type VARCHAR(50) DEFAULT 'standard';
  END IF;
END $$;

-- สร้างตาราง wms_prep_area_count_items
CREATE TABLE IF NOT EXISTS wms_prep_area_count_items (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES wms_stock_count_sessions(id) ON DELETE CASCADE,
  sku_code VARCHAR(50) NOT NULL,
  sku_name VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 0,
  counted_by VARCHAR(50),
  counted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- สร้าง index
CREATE INDEX IF NOT EXISTS idx_prep_area_count_items_session 
ON wms_prep_area_count_items(session_id);

CREATE INDEX IF NOT EXISTS idx_prep_area_count_items_sku 
ON wms_prep_area_count_items(sku_code);

-- Comment
COMMENT ON TABLE wms_prep_area_count_items IS 'รายการนับสต็อกบ้านหยิบ - เก็บ SKU และจำนวนที่นับได้';
COMMENT ON COLUMN wms_prep_area_count_items.session_id IS 'รหัส session การนับ';
COMMENT ON COLUMN wms_prep_area_count_items.sku_code IS 'รหัส SKU';
COMMENT ON COLUMN wms_prep_area_count_items.sku_name IS 'ชื่อ SKU';
COMMENT ON COLUMN wms_prep_area_count_items.quantity IS 'จำนวนที่นับได้ (ชิ้น)';
COMMENT ON COLUMN wms_prep_area_count_items.counted_by IS 'ผู้นับ';
COMMENT ON COLUMN wms_prep_area_count_items.counted_at IS 'เวลาที่นับ';

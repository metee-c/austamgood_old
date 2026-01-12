-- Create table for premium package OCR scans
-- บันทึกแพ็คของแถมที่สแกนด้วย OCR พร้อมเลขโล

CREATE TABLE IF NOT EXISTS premium_package_ocr_scans (
  id SERIAL PRIMARY KEY,
  package_id INTEGER REFERENCES bonus_face_sheet_packages(id),
  barcode_id VARCHAR(50) NOT NULL,
  face_sheet_no VARCHAR(50),
  pack_no VARCHAR(20),
  shop_name VARCHAR(255),
  hub VARCHAR(50),
  lot_no VARCHAR(50), -- เลขโล MR ที่อ่านจาก OCR
  storage_location VARCHAR(50),
  counted_by VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate scans
  CONSTRAINT unique_ocr_barcode UNIQUE (barcode_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ocr_scans_barcode ON premium_package_ocr_scans(barcode_id);
CREATE INDEX IF NOT EXISTS idx_ocr_scans_lot_no ON premium_package_ocr_scans(lot_no);
CREATE INDEX IF NOT EXISTS idx_ocr_scans_created_at ON premium_package_ocr_scans(created_at);

-- Comment
COMMENT ON TABLE premium_package_ocr_scans IS 'บันทึกแพ็คของแถมที่สแกนด้วย OCR พร้อมเลขโล MR';

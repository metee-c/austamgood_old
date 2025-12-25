-- Migration: Create production_receipt_materials table for Variance Tracking
-- Purpose: เก็บข้อมูลการใช้วัตถุดิบจริงต่อ production receipt พร้อม variance tracking
-- Date: 2025-12-23

-- =====================================================
-- 1. Create production_receipt_materials table
-- =====================================================
CREATE TABLE IF NOT EXISTS production_receipt_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to production receipt
    receipt_id UUID NOT NULL REFERENCES production_receipts(id) ON DELETE CASCADE,
    
    -- Material information
    material_sku_id VARCHAR(100) NOT NULL REFERENCES master_sku(sku_id),
    
    -- Quantities
    issued_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
    actual_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
    variance_qty NUMERIC(18,6) GENERATED ALWAYS AS (actual_qty - issued_qty) STORED,
    
    -- Variance classification
    variance_type VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN actual_qty = issued_qty THEN 'exact'
            WHEN actual_qty < issued_qty THEN 'shortage'
            WHEN actual_qty > issued_qty THEN 'excess'
        END
    ) STORED,
    
    -- Variance reason (optional - for audit trail)
    variance_reason VARCHAR(100),
    
    -- Unit of measure
    uom VARCHAR(50),
    
    -- Additional info
    remarks TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. Add comments for documentation
-- =====================================================
COMMENT ON TABLE production_receipt_materials IS 'เก็บข้อมูลการใช้วัตถุดิบจริงต่อ production receipt พร้อม variance tracking';

COMMENT ON COLUMN production_receipt_materials.id IS 'Primary key (UUID)';
COMMENT ON COLUMN production_receipt_materials.receipt_id IS 'FK ไปยัง production_receipts - ใบรับผลิตจริง';
COMMENT ON COLUMN production_receipt_materials.material_sku_id IS 'FK ไปยัง master_sku - รหัสวัตถุดิบ';
COMMENT ON COLUMN production_receipt_materials.issued_qty IS 'จำนวนที่เบิกออกไป (จาก production_order_items หรือ replenishment_queue)';
COMMENT ON COLUMN production_receipt_materials.actual_qty IS 'จำนวนที่ใช้จริง (กรอกโดยผู้ใช้)';
COMMENT ON COLUMN production_receipt_materials.variance_qty IS 'ส่วนต่าง = actual_qty - issued_qty (คำนวณอัตโนมัติ)';
COMMENT ON COLUMN production_receipt_materials.variance_type IS 'ประเภทส่วนต่าง: exact (ตรงกัน), shortage (ใช้น้อยกว่า), excess (ใช้มากกว่า)';
COMMENT ON COLUMN production_receipt_materials.variance_reason IS 'เหตุผลของส่วนต่าง เช่น เสียหาย, หก, ใช้เกิน';
COMMENT ON COLUMN production_receipt_materials.uom IS 'หน่วยนับ';
COMMENT ON COLUMN production_receipt_materials.remarks IS 'หมายเหตุเพิ่มเติม';

-- =====================================================
-- 3. Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_receipt_materials_receipt_id 
    ON production_receipt_materials(receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_materials_material_sku_id 
    ON production_receipt_materials(material_sku_id);

CREATE INDEX IF NOT EXISTS idx_receipt_materials_variance_type 
    ON production_receipt_materials(variance_type);

CREATE INDEX IF NOT EXISTS idx_receipt_materials_created_at 
    ON production_receipt_materials(created_at DESC);

-- =====================================================
-- 4. Create trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_production_receipt_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_production_receipt_materials_updated_at ON production_receipt_materials;
CREATE TRIGGER trg_production_receipt_materials_updated_at
    BEFORE UPDATE ON production_receipt_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_production_receipt_materials_updated_at();

-- =====================================================
-- 5. Enable RLS (Row Level Security)
-- =====================================================
ALTER TABLE production_receipt_materials ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated users" ON production_receipt_materials
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. Create view for variance summary report
-- =====================================================
CREATE OR REPLACE VIEW v_production_variance_summary AS
SELECT 
    prm.receipt_id,
    pr.production_order_id,
    po.production_no,
    prm.material_sku_id,
    ms.sku_name AS material_name,
    prm.issued_qty,
    prm.actual_qty,
    prm.variance_qty,
    prm.variance_type,
    prm.variance_reason,
    prm.uom,
    CASE 
        WHEN prm.issued_qty > 0 THEN 
            ROUND((prm.variance_qty / prm.issued_qty * 100)::NUMERIC, 2)
        ELSE 0
    END AS variance_percentage,
    prm.created_at
FROM production_receipt_materials prm
JOIN production_receipts pr ON prm.receipt_id = pr.id
JOIN production_orders po ON pr.production_order_id = po.id
JOIN master_sku ms ON prm.material_sku_id = ms.sku_id
ORDER BY prm.created_at DESC;

COMMENT ON VIEW v_production_variance_summary IS 'View สรุปข้อมูล variance ของวัตถุดิบในการผลิต';

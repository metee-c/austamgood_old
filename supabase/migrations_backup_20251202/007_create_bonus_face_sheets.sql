-- ===================================================================
-- Migration: Create Bonus Face Sheets Tables
-- Description: สร้างตารางสำหรับจัดการใบปะหน้าของแถม (Bonus Face Sheets)
--              ใช้ร่วมกับ wms_orders ที่มี order_type = 'special'
-- ===================================================================

-- สร้างตาราง bonus_face_sheets (ตารางหลัก)
CREATE TABLE IF NOT EXISTS public.bonus_face_sheets (
    id BIGSERIAL PRIMARY KEY,
    face_sheet_no VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id VARCHAR(20) NOT NULL DEFAULT 'WH01',
    status VARCHAR(20) DEFAULT 'draft',
    delivery_date DATE,
    created_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR(100),
    total_packages INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT bonus_face_sheets_status_check 
        CHECK (status IN ('draft', 'generated', 'printed', 'completed'))
);

COMMENT ON TABLE public.bonus_face_sheets IS 'ตารางหลักสำหรับใบปะหน้าของแถม (Bonus Face Sheets) - ใช้กับ wms_orders ที่ order_type = special';
COMMENT ON COLUMN public.bonus_face_sheets.face_sheet_no IS 'เลขที่ใบปะหน้าของแถม (เช่น BFS-20250116-001)';
COMMENT ON COLUMN public.bonus_face_sheets.warehouse_id IS 'รหัสคลังสินค้า';
COMMENT ON COLUMN public.bonus_face_sheets.status IS 'สถานะ: draft, generated, printed, completed';
COMMENT ON COLUMN public.bonus_face_sheets.delivery_date IS 'วันที่ส่งของ';
COMMENT ON COLUMN public.bonus_face_sheets.total_packages IS 'จำนวนแพ็คทั้งหมด';
COMMENT ON COLUMN public.bonus_face_sheets.total_items IS 'จำนวนรายการสินค้าทั้งหมด';
COMMENT ON COLUMN public.bonus_face_sheets.total_orders IS 'จำนวนออเดอร์ทั้งหมด';

-- สร้างตาราง bonus_face_sheet_packages (แพ็คสินค้า)
CREATE TABLE IF NOT EXISTS public.bonus_face_sheet_packages (
    id BIGSERIAL PRIMARY KEY,
    face_sheet_id BIGINT NOT NULL REFERENCES public.bonus_face_sheets(id) ON DELETE CASCADE,
    package_number INTEGER NOT NULL,
    barcode_id VARCHAR(100) NOT NULL UNIQUE,
    order_id BIGINT REFERENCES public.wms_orders(order_id) ON DELETE SET NULL,
    order_no VARCHAR(100),
    customer_id VARCHAR(50),
    shop_name VARCHAR(255),
    address TEXT,
    province VARCHAR(100),
    contact_info VARCHAR(200),
    phone VARCHAR(50),
    hub VARCHAR(100),
    delivery_type VARCHAR(50),
    remark TEXT,
    sales_territory VARCHAR(100),
    trip_number VARCHAR(50),
    package_weight NUMERIC(15,3) DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT bonus_face_sheet_packages_unique 
        UNIQUE (face_sheet_id, package_number)
);

COMMENT ON TABLE public.bonus_face_sheet_packages IS 'ตารางแพ็คสินค้าของแถมแต่ละแพ็คในใบปะหน้า';
COMMENT ON COLUMN public.bonus_face_sheet_packages.package_number IS 'หมายเลขแพ็ค (เช่น 1, 2, 3)';
COMMENT ON COLUMN public.bonus_face_sheet_packages.barcode_id IS 'รหัสบาร์โค้ดของแพ็ค';
COMMENT ON COLUMN public.bonus_face_sheet_packages.order_id IS 'FK อ้างอิงไปที่ wms_orders';
COMMENT ON COLUMN public.bonus_face_sheet_packages.order_no IS 'เลขที่ใบสั่งส่ง';
COMMENT ON COLUMN public.bonus_face_sheet_packages.delivery_type IS 'ประเภทจัดส่ง (เช่น จัดส่งพร้อมออเดอร์, จัดส่งลงออฟฟิศ)';
COMMENT ON COLUMN public.bonus_face_sheet_packages.remark IS 'หมายเหตุ (ภายใน)';
COMMENT ON COLUMN public.bonus_face_sheet_packages.sales_territory IS 'เขตการขาย';
COMMENT ON COLUMN public.bonus_face_sheet_packages.trip_number IS 'คันที่';

-- สร้างตาราง bonus_face_sheet_items (รายการสินค้าในแต่ละแพ็ค)
CREATE TABLE IF NOT EXISTS public.bonus_face_sheet_items (
    id BIGSERIAL PRIMARY KEY,
    face_sheet_id BIGINT NOT NULL REFERENCES public.bonus_face_sheets(id) ON DELETE CASCADE,
    package_id BIGINT NOT NULL REFERENCES public.bonus_face_sheet_packages(id) ON DELETE CASCADE,
    order_item_id BIGINT REFERENCES public.wms_order_items(order_item_id) ON DELETE SET NULL,
    product_code VARCHAR(100),
    product_name TEXT,
    quantity NUMERIC(15,3) NOT NULL,
    unit VARCHAR(20) DEFAULT 'ชิ้น',
    weight NUMERIC(15,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.bonus_face_sheet_items IS 'ตารางรายการสินค้าของแถมในแต่ละแพ็ค';
COMMENT ON COLUMN public.bonus_face_sheet_items.order_item_id IS 'FK อ้างอิงไปที่ wms_order_items';
COMMENT ON COLUMN public.bonus_face_sheet_items.product_code IS 'รหัสสินค้า';
COMMENT ON COLUMN public.bonus_face_sheet_items.product_name IS 'ชื่อสินค้า';
COMMENT ON COLUMN public.bonus_face_sheet_items.quantity IS 'จำนวน';
COMMENT ON COLUMN public.bonus_face_sheet_items.unit IS 'หน่วย';

-- สร้าง indexes
CREATE INDEX idx_bonus_face_sheets_warehouse ON public.bonus_face_sheets(warehouse_id);
CREATE INDEX idx_bonus_face_sheets_status ON public.bonus_face_sheets(status);
CREATE INDEX idx_bonus_face_sheets_created_date ON public.bonus_face_sheets(created_date);
CREATE INDEX idx_bonus_face_sheet_packages_face_sheet ON public.bonus_face_sheet_packages(face_sheet_id);
CREATE INDEX idx_bonus_face_sheet_packages_order_no ON public.bonus_face_sheet_packages(order_no);
CREATE INDEX idx_bonus_face_sheet_items_face_sheet ON public.bonus_face_sheet_items(face_sheet_id);
CREATE INDEX idx_bonus_face_sheet_items_package ON public.bonus_face_sheet_items(package_id);

-- สร้าง function สำหรับ generate เลขที่ใบปะหน้าของแถม
CREATE OR REPLACE FUNCTION generate_bonus_face_sheet_no()
RETURNS VARCHAR AS $$
DECLARE
    v_date_str VARCHAR;
    v_seq INTEGER;
    v_face_sheet_no VARCHAR;
BEGIN
    -- สร้างรูปแบบ BFS-YYYYMMDD-XXX
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- หาลำดับถัดไป
    SELECT COALESCE(MAX(CAST(SUBSTRING(face_sheet_no FROM 'BFS-[0-9]{8}-([0-9]{3})') AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.bonus_face_sheets
    WHERE face_sheet_no LIKE 'BFS-' || v_date_str || '-%';
    
    -- สร้างเลขที่
    v_face_sheet_no := 'BFS-' || v_date_str || '-' || LPAD(v_seq::TEXT, 3, '0');
    
    RETURN v_face_sheet_no;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_bonus_face_sheet_no() IS 'สร้างเลขที่ใบปะหน้าของแถมอัตโนมัติ (BFS-YYYYMMDD-XXX)';

-- สร้าง trigger สำหรับอัปเดต updated_at
CREATE OR REPLACE FUNCTION update_bonus_face_sheet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bonus_face_sheet_updated_at
    BEFORE UPDATE ON public.bonus_face_sheets
    FOR EACH ROW
    EXECUTE FUNCTION update_bonus_face_sheet_updated_at();

-- สร้าง View สำหรับสรุปข้อมูล
CREATE OR REPLACE VIEW public.bonus_face_sheet_summary AS
SELECT 
    bfs.id,
    bfs.face_sheet_no,
    bfs.warehouse_id,
    bfs.status,
    bfs.created_date,
    bfs.created_by,
    bfs.total_packages,
    bfs.total_items,
    bfs.total_orders,
    bfs.notes,
    bfs.created_at,
    bfs.updated_at,
    COUNT(DISTINCT bfsp.id) AS package_count,
    COUNT(DISTINCT bfsi.id) AS item_count
FROM public.bonus_face_sheets bfs
LEFT JOIN public.bonus_face_sheet_packages bfsp ON bfs.id = bfsp.face_sheet_id
LEFT JOIN public.bonus_face_sheet_items bfsi ON bfs.id = bfsi.face_sheet_id
GROUP BY bfs.id;

COMMENT ON VIEW public.bonus_face_sheet_summary IS 'View สรุปข้อมูลใบปะหน้าของแถม';

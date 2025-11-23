-- Migration: Add Workflow Status Enums
-- Description: เพิ่มสถานะใหม่สำหรับ Route Plans และสร้าง Loadlist Status Enum
-- Date: 2025-01-22

-- ============================================================
-- 1. เพิ่มสถานะใหม่ให้ receiving_route_plan_status_enum
-- ============================================================

-- เพิ่ม 'ready_to_load' - พร้อมขึ้นรถ (เมื่อ Picklists ทั้งหมดเสร็จ)
ALTER TYPE receiving_route_plan_status_enum ADD VALUE IF NOT EXISTS 'ready_to_load';

-- เพิ่ม 'in_transit' - กำลังจัดส่ง (เมื่อรถออกจากคลัง)
ALTER TYPE receiving_route_plan_status_enum ADD VALUE IF NOT EXISTS 'in_transit';

-- อัปเดต Comment
COMMENT ON TYPE receiving_route_plan_status_enum IS 'สถานะของชุดแผนเส้นทางรับสินค้า (draft/optimizing/published/ready_to_load/in_transit/completed/cancelled)';


-- ============================================================
-- 2. สร้าง loadlist_status_enum (ใหม่)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loadlist_status_enum') THEN
        CREATE TYPE loadlist_status_enum AS ENUM (
            'pending',      -- สร้างใหม่
            'loading',      -- กำลังขึ้นรถ (มีการสแกน)
            'loaded',       -- ขึ้นรถเสร็จ พร้อมออก
            'completed',    -- จัดส่งเสร็จทั้งหมด
            'cancelled'     -- ยกเลิก
        );
    END IF;
END $$;

ALTER TYPE loadlist_status_enum OWNER TO postgres;

COMMENT ON TYPE loadlist_status_enum IS 'สถานะของใบขึ้นรถ (pending/loading/loaded/completed/cancelled)';


-- ============================================================
-- 3. อัปเดตตาราง loadlists (ถ้ามี) หรือสร้างใหม่
-- ============================================================

-- ตรวจสอบว่าตาราง loadlists มีอยู่หรือไม่
DO $$
BEGIN
    -- ถ้ามีตารางอยู่แล้ว → เพิ่มคอลัมน์ status
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loadlists'
    ) THEN
        -- เช็คว่ามีคอลัมน์ status หรือยัง
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'loadlists'
            AND column_name = 'status'
        ) THEN
            ALTER TABLE loadlists
            ADD COLUMN status loadlist_status_enum DEFAULT 'pending' NOT NULL;
        END IF;

        -- เช็คว่ามีคอลัมน์ plan_id หรือยัง (สำหรับเชื่อมกับ Route Plan)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'loadlists'
            AND column_name = 'plan_id'
        ) THEN
            ALTER TABLE loadlists
            ADD COLUMN plan_id BIGINT REFERENCES receiving_route_plans(plan_id);
        END IF;

        -- เพิ่ม index
        CREATE INDEX IF NOT EXISTS idx_loadlists_status ON loadlists(status);
        CREATE INDEX IF NOT EXISTS idx_loadlists_plan_id ON loadlists(plan_id);

    ELSE
        -- ถ้าไม่มีตาราง → สร้างใหม่
        CREATE TABLE loadlists (
            id BIGSERIAL PRIMARY KEY,
            loadlist_code VARCHAR(50) UNIQUE NOT NULL,
            plan_id BIGINT REFERENCES receiving_route_plans(plan_id),
            trip_id BIGINT,
            vehicle_id VARCHAR(50),
            driver_employee_id BIGINT,
            status loadlist_status_enum DEFAULT 'pending' NOT NULL,
            total_orders INTEGER DEFAULT 0,
            total_weight_kg NUMERIC(12,3) DEFAULT 0,
            total_volume_cbm NUMERIC(12,3) DEFAULT 0,
            departure_time TIMESTAMPTZ,
            notes TEXT,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT loadlists_total_orders_check CHECK (total_orders >= 0),
            CONSTRAINT loadlists_total_weight_check CHECK (total_weight_kg >= 0),
            CONSTRAINT loadlists_total_volume_check CHECK (total_volume_cbm >= 0)
        );

        -- Indexes
        CREATE INDEX idx_loadlists_status ON loadlists(status);
        CREATE INDEX idx_loadlists_plan_id ON loadlists(plan_id);
        CREATE INDEX idx_loadlists_trip_id ON loadlists(trip_id);
        CREATE INDEX idx_loadlists_created_at ON loadlists(created_at);

        -- RLS
        ALTER TABLE loadlists ENABLE ROW LEVEL SECURITY;

        -- Sequence
        CREATE SEQUENCE IF NOT EXISTS loadlists_id_seq OWNED BY loadlists.id;
        ALTER TABLE loadlists ALTER COLUMN id SET DEFAULT nextval('loadlists_id_seq');

        COMMENT ON TABLE loadlists IS 'ใบขึ้นรถสำหรับการจัดส่ง';
    END IF;
END $$;


-- ============================================================
-- 4. สร้างตาราง loadlist_items (ถ้ายังไม่มี)
-- ============================================================

CREATE TABLE IF NOT EXISTS loadlist_items (
    id BIGSERIAL PRIMARY KEY,
    loadlist_id BIGINT NOT NULL REFERENCES loadlists(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES wms_orders(order_id),
    sequence_no INTEGER,
    weight_kg NUMERIC(12,3),
    volume_cbm NUMERIC(12,3),
    scanned_at TIMESTAMPTZ,
    scanned_by_employee_id BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT loadlist_items_unique_order UNIQUE (loadlist_id, order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loadlist_items_loadlist_id ON loadlist_items(loadlist_id);
CREATE INDEX IF NOT EXISTS idx_loadlist_items_order_id ON loadlist_items(order_id);

-- RLS
ALTER TABLE loadlist_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE loadlist_items IS 'รายการ Orders ที่ขึ้นรถ';


-- ============================================================
-- 5. อัปเดต Comments สำหรับ Status Enums
-- ============================================================

-- Order Status
COMMENT ON TYPE order_status_enum IS 'สถานะของ Order (draft→confirmed→in_picking→picked→loaded→in_transit→delivered)';

-- Picklist Status
COMMENT ON TYPE picklist_status_enum IS 'สถานะของ Picklist (pending→picking→completed)';


-- ============================================================
-- 6. สรุปการเปลี่ยนแปลง
-- ============================================================

-- Migration Summary:
-- 1. ✅ เพิ่มสถานะ 'ready_to_load' และ 'in_transit' ให้ receiving_route_plan_status_enum
-- 2. ✅ สร้าง loadlist_status_enum ใหม่
-- 3. ✅ เพิ่มคอลัมน์ status และ plan_id ให้ตาราง loadlists (ถ้ามีอยู่แล้ว)
-- 4. ✅ สร้างตาราง loadlists ใหม่ (ถ้ายังไม่มี)
-- 5. ✅ สร้างตาราง loadlist_items
-- 6. ✅ อัปเดต Comments

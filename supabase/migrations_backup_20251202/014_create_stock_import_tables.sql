-- ============================================================================
-- Migration: สร้างตารางสำหรับระบบนำเข้าสต็อกจากระบบเก่า
-- File: 014_create_stock_import_tables.sql
-- Created: 2025-11-19
-- Description: สร้าง staging tables และ batch tracking สำหรับ stock import
-- ============================================================================

-- ============================================================================
-- 1. สร้างตาราง wms_stock_import_batches (Import Batch Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."wms_stock_import_batches" (
    "batch_id" character varying(100) NOT NULL,
    "batch_name" character varying(255),
    "warehouse_id" character varying(50) NOT NULL,

    -- ข้อมูลไฟล์
    "file_name" character varying(255),
    "file_size" bigint,
    "file_type" character varying(50), -- 'csv' หรือ 'excel'
    "total_rows" integer DEFAULT 0,

    -- สถิติการประมวลผล
    "validated_rows" integer DEFAULT 0,
    "error_rows" integer DEFAULT 0,
    "processed_rows" integer DEFAULT 0,
    "skipped_rows" integer DEFAULT 0,

    -- สถานะ
    "status" character varying(20) DEFAULT 'uploading',
    -- 'uploading', 'validating', 'validated', 'processing', 'completed', 'failed', 'cancelled'

    -- เวลา
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,

    -- ผู้ใช้
    "created_by" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,

    -- สรุปผลลัพธ์
    "validation_summary" jsonb,
    "processing_summary" jsonb,
    "error_summary" jsonb,

    CONSTRAINT "wms_stock_import_batches_pkey" PRIMARY KEY ("batch_id"),
    CONSTRAINT "wms_stock_import_batches_warehouse_fk"
        FOREIGN KEY ("warehouse_id")
        REFERENCES "public"."master_warehouse"("warehouse_id")
        ON DELETE RESTRICT,
    CONSTRAINT "wms_stock_import_batches_status_check"
        CHECK (("status")::"text" = ANY (
            ARRAY[
                'uploading'::character varying,
                'validating'::character varying,
                'validated'::character varying,
                'processing'::character varying,
                'completed'::character varying,
                'failed'::character varying,
                'cancelled'::character varying
            ]::"text"[]
        ))
);

-- Comments
COMMENT ON TABLE "public"."wms_stock_import_batches" IS 'ตารางติดตาม batch การนำเข้าสต็อกจากระบบเก่า';
COMMENT ON COLUMN "public"."wms_stock_import_batches"."batch_id" IS 'รหัส batch (เช่น IMP-20251119-001)';
COMMENT ON COLUMN "public"."wms_stock_import_batches"."status" IS 'สถานะการประมวลผล';
COMMENT ON COLUMN "public"."wms_stock_import_batches"."validation_summary" IS 'สรุปผลการตรวจสอบ (JSON)';
COMMENT ON COLUMN "public"."wms_stock_import_batches"."processing_summary" IS 'สรุปผลการนำเข้า (JSON)';

-- Indexes
CREATE INDEX "idx_stock_import_batches_warehouse"
    ON "public"."wms_stock_import_batches"("warehouse_id");

CREATE INDEX "idx_stock_import_batches_status"
    ON "public"."wms_stock_import_batches"("status");

CREATE INDEX "idx_stock_import_batches_created_at"
    ON "public"."wms_stock_import_batches"("created_at" DESC);


-- ============================================================================
-- 2. สร้างตาราง wms_stock_import_staging (Staging Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."wms_stock_import_staging" (
    "staging_id" bigserial NOT NULL,
    "import_batch_id" character varying(100) NOT NULL,
    "row_number" integer, -- แถวที่ในไฟล์

    -- ข้อมูลจากไฟล์ระบบเก่า (ตามโครงสร้างเดิม)
    "location_id" character varying(50),
    "zone" character varying(50),
    "row_code" character varying(50),
    "level_code" character varying(50),
    "loc_code" character varying(50),
    "sku_pick_face" character varying(50),
    "max_weight" numeric(10,3),
    "max_pallet" integer,
    "max_high" character varying(50),
    "location_status" character varying(50),

    "pallet_id_check" character varying(100),
    "pallet_id_external" character varying(100),
    "last_updated_check" character varying(100),
    "last_updated_check_2" character varying(100),
    "last_updated" character varying(100),

    "sku_id" character varying(50),
    "product_name" "text",
    "pack_qty" numeric(18,2),
    "piece_qty" numeric(18,2),
    "weight_kg" numeric(10,3),
    "lot_no" character varying(100),
    "received_date" character varying(50),
    "expiration_date" character varying(50),
    "barcode" character varying(100),
    "name_edit" character varying(255),
    "stock_status" character varying(50),
    "pallet_color" character varying(50),
    "remarks" "text",

    -- ข้อมูลเพิ่มเติมจากระบบใหม่
    "warehouse_id" character varying(50), -- จากการเลือกในหน้า import

    -- วันที่ที่แปลงแล้ว (parsed dates)
    "parsed_received_date" "date",
    "parsed_expiration_date" "date",
    "parsed_last_updated" timestamp with time zone,

    -- สถานะการประมวลผล
    "processing_status" character varying(20) DEFAULT 'pending',
    -- 'pending', 'validated', 'processed', 'error', 'skipped'

    "validation_errors" "text"[], -- array ของ error messages
    "validation_warnings" "text"[], -- array ของ warning messages

    "processed_at" timestamp with time zone,
    "processed_balance_id" bigint, -- FK to wms_inventory_balances
    "processed_ledger_id" bigint, -- FK to wms_inventory_ledger

    -- เวลาสร้าง
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" bigint,

    CONSTRAINT "wms_stock_import_staging_pkey" PRIMARY KEY ("staging_id"),
    CONSTRAINT "wms_stock_import_staging_batch_fk"
        FOREIGN KEY ("import_batch_id")
        REFERENCES "public"."wms_stock_import_batches"("batch_id")
        ON DELETE CASCADE,
    CONSTRAINT "wms_stock_import_staging_status_check"
        CHECK (("processing_status")::"text" = ANY (
            ARRAY[
                'pending'::character varying,
                'validated'::character varying,
                'processed'::character varying,
                'error'::character varying,
                'skipped'::character varying
            ]::"text"[]
        ))
);

-- Comments
COMMENT ON TABLE "public"."wms_stock_import_staging" IS 'ตาราง staging สำหรับเก็บข้อมูลก่อนนำเข้าจริง';
COMMENT ON COLUMN "public"."wms_stock_import_staging"."row_number" IS 'หมายเลขแถวในไฟล์ต้นฉบับ';
COMMENT ON COLUMN "public"."wms_stock_import_staging"."processing_status" IS 'สถานะการประมวลผล';
COMMENT ON COLUMN "public"."wms_stock_import_staging"."validation_errors" IS 'รายการ error จากการ validate';
COMMENT ON COLUMN "public"."wms_stock_import_staging"."validation_warnings" IS 'รายการ warning จากการ validate';

-- Indexes
CREATE INDEX "idx_stock_import_staging_batch"
    ON "public"."wms_stock_import_staging"("import_batch_id");

CREATE INDEX "idx_stock_import_staging_status"
    ON "public"."wms_stock_import_staging"("processing_status");

CREATE INDEX "idx_stock_import_staging_location"
    ON "public"."wms_stock_import_staging"("location_id");

CREATE INDEX "idx_stock_import_staging_sku"
    ON "public"."wms_stock_import_staging"("sku_id");


-- ============================================================================
-- 3. สร้าง Sequence สำหรับสร้าง Batch ID
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS "public"."wms_stock_import_batch_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

COMMENT ON SEQUENCE "public"."wms_stock_import_batch_seq" IS 'Sequence สำหรับสร้างหมายเลข batch import';


-- ============================================================================
-- 4. สร้าง Function สำหรับสร้าง Batch ID
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."generate_stock_import_batch_id"()
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
    new_id VARCHAR(100);
    seq_num INTEGER;
    date_part VARCHAR(8);
BEGIN
    -- Get date in YYYYMMDD format
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Get next sequence number
    seq_num := nextval('wms_stock_import_batch_seq');

    -- Format: IMP-YYYYMMDD-XXX
    new_id := 'IMP-' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');

    RETURN new_id;
END;
$$;

COMMENT ON FUNCTION "public"."generate_stock_import_batch_id"() IS 'สร้างรหัส batch สำหรับการนำเข้าสต็อก (เช่น IMP-20251119-001)';


-- ============================================================================
-- 5. สร้าง View สำหรับดูสรุป Import Batches
-- ============================================================================

CREATE OR REPLACE VIEW "public"."vw_stock_import_batches_summary" AS
SELECT
    b.batch_id,
    b.batch_name,
    b.warehouse_id,
    mw.warehouse_name,
    b.file_name,
    b.file_type,
    b.total_rows,
    b.validated_rows,
    b.error_rows,
    b.processed_rows,
    b.skipped_rows,
    b.status,
    b.created_at,
    b.started_at,
    b.completed_at,

    -- คำนวณเวลาที่ใช้
    CASE
        WHEN b.completed_at IS NOT NULL AND b.started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (b.completed_at - b.started_at))
        ELSE NULL
    END AS processing_duration_seconds,

    -- คำนวณเปอร์เซ็นต์ความสำเร็จ
    CASE
        WHEN b.total_rows > 0 THEN
            ROUND((b.processed_rows::numeric / b.total_rows::numeric) * 100, 2)
        ELSE 0
    END AS success_percentage,

    -- ข้อมูลผู้สร้าง
    me.first_name || ' ' || me.last_name AS created_by_name,

    b.validation_summary,
    b.processing_summary,
    b.error_summary

FROM wms_stock_import_batches b
LEFT JOIN master_warehouse mw ON mw.warehouse_id = b.warehouse_id
LEFT JOIN master_employee me ON me.employee_id = b.created_by;

COMMENT ON VIEW "public"."vw_stock_import_batches_summary" IS 'View สรุปข้อมูล import batches พร้อมสถิติ';


-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."wms_stock_import_batches" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."wms_stock_import_staging" TO authenticated;
GRANT USAGE ON SEQUENCE "public"."wms_stock_import_batch_seq" TO authenticated;
GRANT SELECT ON "public"."vw_stock_import_batches_summary" TO authenticated;

-- Grant permissions to anon (if needed for public access)
-- GRANT SELECT ON "public"."vw_stock_import_batches_summary" TO anon;


-- ============================================================================
-- 7. Sample Data (สำหรับทดสอบ - สามารถลบได้)
-- ============================================================================

-- เพิ่ม comment นี้เพื่อไม่ให้ insert ข้อมูลตัวอย่างในการ migrate จริง
/*
INSERT INTO wms_stock_import_batches (
    batch_id,
    batch_name,
    warehouse_id,
    file_name,
    file_type,
    total_rows,
    status,
    created_by
) VALUES (
    generate_stock_import_batch_id(),
    'ทดสอบนำเข้าสต็อกครั้งที่ 1',
    'WH-001',
    'stock_data_sample.csv',
    'csv',
    0,
    'uploading',
    1
);
*/

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- สร้างตารางเสร็จสมบูรณ์:
-- 1. wms_stock_import_batches - ติดตาม import batches
-- 2. wms_stock_import_staging - เก็บข้อมูล staging
-- 3. generate_stock_import_batch_id() - function สร้าง batch ID
-- 4. vw_stock_import_batches_summary - view สรุปข้อมูล
-- ============================================================================
